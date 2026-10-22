import { useState, useEffect, useCallback } from 'react';
import { addOfflineSubmission, getOfflineSubmissions, deleteOfflineSubmission } from '../db/indexedDb';
import { API } from '../config/api';

// Status codes where the server has definitively looked at the payload and
// rejected it (bad data, duplicate NIN/PVC). Retrying it unchanged will
// never succeed — these must NOT go into the offline queue.
const isPermanentRejection = (status) => status === 400 || status === 409 || status === 422;

// Turn the server's rejection into a readable message, including which
// fields failed (the server sends these in `details`).
const describeRejection = (data) => {
  const base = describeRejection(data);
  if (!Array.isArray(data.details) || data.details.length === 0) return base;
  const reasons = data.details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message));
  return `${base} ${reasons.join(' ')}`;
};

export function useOfflineForm() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  // Items that failed sync permanently (rejected by the server, not a
  // network issue) — surfaced so the UI can tell the person, rather than
  // vanishing silently into a queue that will never succeed.
  const [syncErrors, setSyncErrors] = useState([]);

  const updateQueueCount = useCallback(async () => {
    const items = await getOfflineSubmissions();
    setQueueCount(items.length);
  }, []);

  const syncQueueWithServer = useCallback(async () => {
    if (!navigator.onLine || syncing) return;

    const items = await getOfflineSubmissions();
    if (items.length === 0) return;

    setSyncing(true);
    for (const item of items) {
      try {
        // Clean off the local auto-increment wrapper key before syncing to MongoDB
        const { localId, ...cleanData } = item;

        const response = await fetch(API.submitNomination, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanData),
        });

        if (response.ok) {
          await deleteOfflineSubmission(localId);
          continue;
        }

        if (isPermanentRejection(response.status)) {
          // Server processed it and rejected it — remove from the queue
          // (retrying won't help) and record why, so the UI can tell
          // the person their submission needs correcting.
          const data = await response.json().catch(() => ({}));
          await deleteOfflineSubmission(localId);
          setSyncErrors((prev) => [
            ...prev,
            { localId, fullName: cleanData.fullName, error: describeRejection(data) },
          ]);
          continue;
        }

        // Transient server-side issue (5xx, 429 rate limit) — leave it
        // queued and stop this pass; don't hammer a struggling server.
        console.warn(`Sync paused: server returned ${response.status}. Will retry later.`);
        break;
      } catch (err) {
        // Genuine network failure (offline mid-loop, DNS failure, etc.)
        console.error('Remote sync retry cycle suspended: Target host unreachable.', err);
        break;
      }
    }
    await updateQueueCount();
    setSyncing(false);
  }, [syncing, updateQueueCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueueWithServer();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    updateQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueueWithServer, updateQueueCount]);

  const submitForm = async (formData) => {
    if (navigator.onLine) {
      try {
        const response = await fetch(API.submitNomination, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          return { success: true, status: 'online' };
        }

        if (isPermanentRejection(response.status)) {
          // Do NOT queue — this needs the person's attention right now
          // (duplicate NIN/PVC, invalid field, etc).
          const data = await response.json().catch(() => ({}));
          return { success: false, status: 'rejected', error: describeRejection(data) };
        }

        // Transient (5xx/429) — the server is reachable but struggling;
        // safe to queue and retry.
        await addOfflineSubmission(formData);
        await updateQueueCount();
        return { success: true, status: 'cached' };
      } catch (err) {
        // fetch threw — genuine network failure, not a server response
        console.warn('Online submission failed due to network flux. Falling back to local storage.');
        await addOfflineSubmission(formData);
        await updateQueueCount();
        return { success: true, status: 'cached' };
      }
    } else {
      await addOfflineSubmission(formData);
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