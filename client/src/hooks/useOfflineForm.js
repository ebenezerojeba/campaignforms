import { useState, useEffect, useCallback, useRef } from 'react';
import { addOfflineSubmission, getOfflineSubmissions, deleteOfflineSubmission } from '../db/indexedDb';
import { API } from '../config/api';
import { uploadPhotoToCloudinary } from '../utils/cloudinaryUpload';

// The server looked at the data and rejected it (bad field, duplicate
// NIN/PVC). Retrying unchanged will never work, so these are not queued.
const isPermanentRejection = (status) => status === 400 || status === 409 || status === 422;

// How often to retry saved entries while any are waiting.
const RETRY_INTERVAL_MS = 20_000;

// Readable rejection message, including which fields failed.
const describeRejection = (data) => {
  const base = data.error || 'Submission was rejected.';
  if (!Array.isArray(data.details) || data.details.length === 0) return base;
  const reasons = data.details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message));
  return `${base} ${reasons.join(' ')}`;
};

class PermanentRejection extends Error {}

/**
 * Sends one submission: uploads the photo first if it hasn't been uploaded
 * yet, then posts the form. Throws PermanentRejection if the server refuses
 * the data; any other throw means "try again later".
 */
async function sendSubmission(formData, photoBlob) {
  let payload = formData;

  if (!payload.photoUrl) {
    if (!photoBlob) throw new PermanentRejection('Photo is missing. Please fill the form again with a photo.');
    const { url, publicId } = await uploadPhotoToCloudinary(photoBlob);
    payload = { ...payload, photoUrl: url, photoPublicId: publicId };
  }

  const response = await fetch(API.submitNomination, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.ok) return payload;

  const data = await response.json().catch(() => ({}));
  if (isPermanentRejection(response.status)) throw new PermanentRejection(describeRejection(data));

  // 429 (rate limit) or 5xx: server reachable but not accepting right now.
  const err = new Error(data.error || `Server returned ${response.status}`);
  err.payload = payload; // keep the uploaded photo URL so it isn't uploaded twice
  throw err;
}

export function useOfflineForm() {
  // Display only — the browser's online flag is unreliable on many phones,
  // so it never decides whether we try to send.
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncErrors, setSyncErrors] = useState([]);
  const syncingRef = useRef(false);

  const updateQueueCount = useCallback(async () => {
    try {
      const items = await getOfflineSubmissions();
      setQueueCount(items.length);
      return items.length;
    } catch {
      return 0;
    }
  }, []);

  const syncQueueWithServer = useCallback(async () => {
    if (syncingRef.current) return;
    const items = await getOfflineSubmissions().catch(() => []);
    if (items.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);
    try {
      for (const item of items) {
        const { localId, photoBlob, ...formData } = item;
        try {
          await sendSubmission(formData, photoBlob);
          await deleteOfflineSubmission(localId);
        } catch (err) {
          if (err instanceof PermanentRejection) {
            await deleteOfflineSubmission(localId);
            setSyncErrors((prev) => [...prev, { localId, fullName: formData.fullName, error: err.message }]);
            continue;
          }
          // Network or server problem: keep it (with the photo URL if we got
          // that far) and stop this round.
          if (err.payload?.photoUrl && !formData.photoUrl) {
            await deleteOfflineSubmission(localId);
            await addOfflineSubmission({ ...err.payload });
          }
          console.warn('Sync paused, will retry:', err.message);
          break;
        }
      }
    } finally {
      await updateQueueCount();
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [updateQueueCount]);

  // Retry saved entries: on load, when the connection comes back, when the
  // person returns to the tab, and on a timer while anything is waiting.
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueueWithServer();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisible = () => {
      if (document.visibilityState === 'visible') syncQueueWithServer();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisible);

    updateQueueCount().then((count) => count > 0 && syncQueueWithServer());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [syncQueueWithServer, updateQueueCount]);

  useEffect(() => {
    if (queueCount === 0) return;
    const timer = setInterval(syncQueueWithServer, RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [queueCount, syncQueueWithServer]);

  /**
   * Always tries to send straight away. Saves on the device only if that
   * fails for a reason that a retry could fix (no connection, server busy).
   * Resolves to { success, status: 'online' | 'cached' | 'rejected', error? }.
   */
  const submitForm = async (formData, photoBlob) => {
    try {
      await sendSubmission(formData, photoBlob);
      setIsOnline(true);
      return { success: true, status: 'online' };
    } catch (err) {
      if (err instanceof PermanentRejection) {
        return { success: false, status: 'rejected', error: err.message };
      }
      console.warn('Could not send now, saving on this device:', err.message);
      try {
        await addOfflineSubmission({ ...(err.payload || formData), photoBlob });
      } catch {
        return { success: false, status: 'rejected', error: 'Could not send or save this entry. Please try again.' };
      }
      await updateQueueCount();
      return { success: true, status: 'cached' };
    }
  };

  const dismissSyncError = (localId) => {
    setSyncErrors((prev) => prev.filter((e) => e.localId !== localId));
  };

  return {
    isOnline,
    queueCount,
    syncing,
    syncErrors,
    dismissSyncError,
    submitForm,
    triggerManualSync: syncQueueWithServer,
  };
}
