import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createOperationalFallbackDb,
  isOperationalModuleUnavailable,
  loadOperationalSnapshot,
  mergeSnapshotIntoDb,
  PERSISTED_COLLECTION_KEYS,
  syncOperationalCollections,
} from '../services/operationalData';

export function useOperationalData(user) {
  const [db, setDbState] = useState(() => createOperationalFallbackDb());
  const [dataReady, setDataReady] = useState(false);
  const [dataSource, setDataSource] = useState('loading');
  const [dataError, setDataError] = useState(null);
  const dbRef = useRef(db);
  const hydratingRef = useRef(false);
  const syncQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      if (!user?.id) {
        if (!active) return;
        hydratingRef.current = false;
        setDbState(createOperationalFallbackDb());
        setDataSource('signed_out');
        setDataError(null);
        setDataReady(true);
        return;
      }

      hydratingRef.current = true;
      setDataReady(false);

      const { data, error } = await loadOperationalSnapshot();

      if (!active) {
        hydratingRef.current = false;
        return;
      }

      if (error) {
        const fallback = createOperationalFallbackDb();
        dbRef.current = fallback;
        setDbState(fallback);
        setDataSource(isOperationalModuleUnavailable(error) ? 'fallback' : 'fallback_error');
        setDataError(error);
        setDataReady(true);
        hydratingRef.current = false;
        return;
      }

      const merged = mergeSnapshotIntoDb(data);
      dbRef.current = merged;
      setDbState(merged);
      setDataSource('supabase');
      setDataError(null);
      setDataReady(true);
      hydratingRef.current = false;
    }

    hydrate();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const enqueueSync = useCallback((prev, next) => {
    if (!user?.id || hydratingRef.current || dataSource !== 'supabase') {
      return;
    }

    const changes = {};
    for (const key of PERSISTED_COLLECTION_KEYS) {
      if (prev?.[key] !== next?.[key]) {
        changes[key] = Array.isArray(next?.[key]) ? next[key] : [];
      }
    }

    if (!Object.keys(changes).length) {
      return;
    }

    syncQueueRef.current = syncQueueRef.current
      .then(async () => {
        const { error } = await syncOperationalCollections(changes, user.id);
        if (error) {
          throw error;
        }
      })
      .catch((error) => {
        console.error('Erro ao sincronizar dados operacionais:', error);
        setDataError(error);
      });
  }, [user?.id, dataSource]);

  const setDb = useCallback((updater) => {
    const prev = dbRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    dbRef.current = next;
    setDbState(next);
    enqueueSync(prev, next);
  }, [enqueueSync]);

  return useMemo(() => ({
    db,
    setDb,
    dataReady,
    dataSource,
    dataError,
  }), [db, setDb, dataReady, dataSource, dataError]);
}
