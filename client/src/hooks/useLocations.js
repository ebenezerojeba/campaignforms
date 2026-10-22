import { useState, useEffect, useCallback, useRef } from 'react';
import { API } from '../config/api';

/**
 * Drives a three-level cascading select: LGA -> Ward -> Polling Unit.
 * Selecting a new LGA clears ward + PU; selecting a new ward clears PU —
 * this stops a stale ward/PU combination from a previous LGA silently
 * surviving into a new selection.
 *
 * Caches each level's fetched list in memory for the component's
 * lifetime, so flipping back to an already-visited LGA/ward doesn't
 * re-hit the network — meaningful on the flaky mobile connections this
 * form is built for.
 */
export function useLocations() {
  const [lgas, setLgas] = useState([]);
  const [wards, setWards] = useState([]);
  const [pollingUnits, setPollingUnits] = useState([]);

  const [selectedLga, setSelectedLga] = useState('');
  const [selectedWard, setSelectedWard] = useState('');

  const [loadingLgas, setLoadingLgas] = useState(true);
  const [loadingWards, setLoadingWards] = useState(false);
  const [loadingPUs, setLoadingPUs] = useState(false);
  const [error, setError] = useState('');

  const wardCache = useRef(new Map());
  const puCache = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API.lgas);
        if (!res.ok) throw new Error('Failed to load LGA list.');
        const { data } = await res.json();
        if (!cancelled) setLgas(data);
      } catch (err) {
        if (!cancelled) setError('Could not load LGA list. Check your connection and reload.');
      } finally {
        if (!cancelled) setLoadingLgas(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectLga = useCallback(async (lga) => {
    setSelectedLga(lga);
    setSelectedWard('');
    setPollingUnits([]);
    setError('');

    if (!lga) {
      setWards([]);
      return;
    }

    if (wardCache.current.has(lga)) {
      setWards(wardCache.current.get(lga));
      return;
    }

    setLoadingWards(true);
    try {
      const res = await fetch(API.wards(lga));
      if (!res.ok) throw new Error('Failed to load wards.');
      const { data } = await res.json();
      wardCache.current.set(lga, data);
      setWards(data);
    } catch (err) {
      setError('Could not load wards for that LGA. Check your connection and try again.');
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  }, []);

  const selectWard = useCallback(async (ward) => {
    setSelectedWard(ward);
    setError('');

    if (!ward || !selectedLga) {
      setPollingUnits([]);
      return;
    }

    const cacheKey = `${selectedLga}::${ward}`;
    if (puCache.current.has(cacheKey)) {
      setPollingUnits(puCache.current.get(cacheKey));
      return;
    }

    setLoadingPUs(true);
    try {
      const res = await fetch(API.pollingUnits(selectedLga, ward));
      if (!res.ok) throw new Error('Failed to load polling units.');
      const { data } = await res.json();
      puCache.current.set(cacheKey, data);
      setPollingUnits(data);
    } catch (err) {
      setError('Could not load polling units for that ward. Check your connection and try again.');
      setPollingUnits([]);
    } finally {
      setLoadingPUs(false);
    }
  }, [selectedLga]);

  return {
    lgas, wards, pollingUnits,
    selectedLga, selectedWard,
    selectLga, selectWard,
    loadingLgas, loadingWards, loadingPUs,
    error,
  };
}