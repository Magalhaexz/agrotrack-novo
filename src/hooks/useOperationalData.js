import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ensureSupabaseRequestReadiness } from '../services/operationalPersistence';

const OPERACIONAL_TABLES = [
  'fazendas',
  'lotes',
  'animais',
  'custos',
  'pesagens',
  'sanitario',
  'tarefas',
  'estoque',
  'movimentacoes_animais',
  'movimentacoes_financeiras',
  'movimentacoes_estoque',
  'funcionarios',
  'rotinas',
  'alertas_resolvidos',
  'usuarios',
  'configuracoes',
];

const OWNER_SCOPED_TABLES = new Set(OPERACIONAL_TABLES);
const HYDRATION_CONCURRENCY_LIMIT = 3;
const HYDRATION_MAX_ATTEMPTS = 2;
const HYDRATION_BACKOFF_MS = 350;
const HYDRATION_START_DELAY_MS = 1800;
const HYDRATION_FAILURE_COOLDOWN_MS = 45000;
const HYDRATION_FAILURES_TO_OPEN_CIRCUIT = 4;
const HERDON_DISABLE_SUPABASE_SYNC = 'HERDON_DISABLE_SUPABASE_SYNC';
const HERDON_ENABLE_SUPABASE_SYNC = 'HERDON_ENABLE_SUPABASE_SYNC';
const inFlightSnapshots = new Map();
const failedHydrationAt = new Map();
const schemaWarningTables = new Set();
let autoSyncDisabledLogged = false;

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function wait(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || error.name || String(error);
}

function isTransientHydrationError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return [
    'err_http2_protocol_error',
    'err_connection_reset',
    'err_connection_closed',
    'failed to fetch',
    'timeout',
    'networkerror',
    'network error',
    'fetch failed',
  ].some((signature) => message.includes(signature));
}

function isSchemaNotFoundError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    error?.status === 404
    || error?.code === '42P01'
    || message.includes('404')
    || message.includes('not found')
    || message.includes('relation')
    || message.includes('does not exist')
  );
}

function shouldDisableSupabaseSync() {
  try {
    const raw = localStorage.getItem(HERDON_DISABLE_SUPABASE_SYNC);
    if (!raw) return false;
    const normalized = String(raw).toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  } catch {
    return false;
  }
}

function shouldEnableSupabaseSync() {
  try {
    const raw = localStorage.getItem(HERDON_ENABLE_SUPABASE_SYNC);
    if (!raw) return false;
    const normalized = String(raw).toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  } catch {
    return false;
  }
}

function logSyncGuard(payload, level = 'debug') {
  if (!import.meta.env.DEV) return;
  const logger = level === 'warn' ? console.warn : console.debug;
  logger('[HERDON_SYNC_GUARD]', payload);
}

function normalizeDb(baseDb) {
  return {
    ...baseDb,
    alertas_resolvidos: Array.isArray(baseDb?.alertas_resolvidos) ? baseDb.alertas_resolvidos : [],
    funcionarios: Array.isArray(baseDb?.funcionarios) ? baseDb.funcionarios : [],
    lotes: Array.isArray(baseDb?.lotes)
      ? baseDb.lotes.map((lote) => ({
          ...lote,
          status: lote?.status || 'ativo',
          data_encerramento: lote?.data_encerramento || null,
          data_venda: lote?.data_venda || null,
        }))
      : [],
    fazendas: Array.isArray(baseDb?.fazendas) ? baseDb.fazendas : [],
    tarefas: Array.isArray(baseDb?.tarefas) ? baseDb.tarefas : [],
    configuracoes: baseDb?.configuracoes || {
      geral: {
        nome_sistema: 'HERDON',
        moeda: 'BRL',
        formato_data: 'DD/MM/AAAA',
        unidade_peso: 'kg',
        rendimento_carcaca_padrao: 52,
        preco_arroba_padrao: 290,
      },
      notificacoes: {
        estoque_critico: true,
        sanitario_vencido: true,
        pesagem_atrasada: true,
        lote_data_saida: true,
        dias_antecedencia: 3,
      },
    },
    usuarios: Array.isArray(baseDb?.usuarios) ? baseDb.usuarios : [],
  };
}

export function createOperationalFallbackDb(initialDb) {
  return normalizeDb(initialDb || {});
}

async function fetchOperationalTableWithCircuit(table, userId, shouldApply, circuitState) {
  if (!shouldApply()) {
    return [table, []];
  }
  if (circuitState.open) {
    logSyncGuard({
      stage: 'circuit_open_skip_table',
      table,
      failureCount: circuitState.failures,
    });
    return [table, []];
  }

  for (let attempt = 1; attempt <= HYDRATION_MAX_ATTEMPTS + 1; attempt += 1) {
    if (!shouldApply()) {
      return [table, []];
    }
    if (circuitState.open) {
      return [table, []];
    }

    const startedAt = nowMs();
    try {
      let query = supabase.from(table).select('*');
      if (OWNER_SCOPED_TABLES.has(table)) {
        query = query.eq('owner_user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const durationMs = Number((nowMs() - startedAt).toFixed(1));
      if (import.meta.env.DEV) {
        console.debug('[HERDON_DATA_BOOT]', {
          stage: 'table_success',
          table,
          attempt,
          durationMs,
          rows: Array.isArray(data) ? data.length : 0,
        });
      }
      return [table, Array.isArray(data) ? data : []];
    } catch (error) {
      const durationMs = Number((nowMs() - startedAt).toFixed(1));
      const schema404 = isSchemaNotFoundError(error);
      const transient = isTransientHydrationError(error);
      const canRetry = !schema404 && transient && attempt <= HYDRATION_MAX_ATTEMPTS;

      if (schema404 && !schemaWarningTables.has(table) && import.meta.env.DEV) {
        schemaWarningTables.add(table);
        console.warn('[HERDON_SUPABASE_SCHEMA]', {
          table,
          status: error?.status || 404,
          code: error?.code || null,
          message: getErrorMessage(error) || 'schema_not_found',
        });
      }

      if (import.meta.env.DEV) {
        console.warn('[HERDON_DATA_BOOT]', {
          stage: canRetry ? 'table_retrying' : 'table_failure',
          table,
          attempt,
          durationMs,
          transient,
          schema404,
          errorType: getErrorMessage(error) || 'hydration_error',
        });
      }

      if (canRetry) {
        await wait(HYDRATION_BACKOFF_MS * attempt);
        continue;
      }

      circuitState.failures += 1;
      if (circuitState.failures >= HYDRATION_FAILURES_TO_OPEN_CIRCUIT) {
        circuitState.open = true;
        logSyncGuard({
          stage: 'circuit_opened',
          table,
          failureCount: circuitState.failures,
        }, 'warn');
      }
      return [table, []];
    }
  }

  circuitState.failures += 1;
  if (circuitState.failures >= HYDRATION_FAILURES_TO_OPEN_CIRCUIT) {
    circuitState.open = true;
  }
  return [table, []];
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    })
  );

  return results;
}

async function loadOperationalSnapshotRequest(userId, shouldApply, generationId) {
  const bootStart = nowMs();
  if (import.meta.env.DEV) {
    console.debug('[HERDON_DATA_BOOT]', {
      stage: 'snapshot_start',
      generationId,
      hasUserId: Boolean(userId),
      tables: OPERACIONAL_TABLES.length,
      concurrencyLimit: HYDRATION_CONCURRENCY_LIMIT,
    });
  }

  const circuitState = { failures: 0, open: false };
  const entries = await runWithConcurrency(
    OPERACIONAL_TABLES,
    HYDRATION_CONCURRENCY_LIMIT,
    (table) => fetchOperationalTableWithCircuit(table, userId, shouldApply, circuitState)
  );

  if (import.meta.env.DEV) {
    console.debug('[HERDON_DATA_BOOT]', {
      stage: 'snapshot_complete',
      generationId,
      durationMs: Number((nowMs() - bootStart).toFixed(1)),
      circuitOpen: circuitState.open,
      failureCount: circuitState.failures,
    });
  }
  return {
    snapshot: Object.fromEntries(entries),
    circuitOpen: circuitState.open,
  };
}

async function loadOperationalSnapshot(userId, shouldApply, generationId) {
  if (!userId) {
    return {};
  }

  const lastFailureAt = failedHydrationAt.get(userId) || 0;
  if (Date.now() - lastFailureAt < HYDRATION_FAILURE_COOLDOWN_MS) {
    if (import.meta.env.DEV) {
      console.debug('[HERDON_DATA_BOOT]', {
        stage: 'snapshot_skip_recent_failure',
        generationId,
        hasUserId: true,
      });
    }
    return {};
  }

  const existing = inFlightSnapshots.get(userId);
  if (existing) {
    if (import.meta.env.DEV) {
      console.debug('[HERDON_DATA_BOOT]', {
        stage: 'snapshot_reuse_in_flight',
        generationId,
      });
    }
    return existing;
  }

  const request = loadOperationalSnapshotRequest(userId, shouldApply, generationId)
    .then((snapshot) => {
      if (snapshot?.circuitOpen) {
        failedHydrationAt.set(userId, Date.now());
      } else {
        failedHydrationAt.delete(userId);
      }
      return snapshot;
    })
    .catch((error) => {
      failedHydrationAt.set(userId, Date.now());
      throw error;
    })
    .finally(() => {
      if (inFlightSnapshots.get(userId) === request) {
        inFlightSnapshots.delete(userId);
      }
    });

  inFlightSnapshots.set(userId, request);
  return request;
}

export function useOperationalData(initialDb, session, options = {}) {
  const hydrationEnabled = options?.enabled !== false;
  const [db, setDbState] = useState(() => createOperationalFallbackDb(initialDb));
  const [dataReady, setDataReady] = useState(true);
  const [dataSource, setDataSource] = useState('signed_out');
  const [dataError, setDataError] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [manualSyncNonce, setManualSyncNonce] = useState(0);
  const hydratingRef = useRef(false);
  const hydrationGenerationRef = useRef(0);
  const localMutationRef = useRef(0);
  const currentUserIdRef = useRef(null);
  const previousUserIdRef = useRef(null);

  const setDb = useCallback((updater) => {
    localMutationRef.current += 1;
    setDbState(updater);
  }, []);

  const syncNow = useCallback(() => {
    setManualSyncNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    const userId = session?.user?.id || null;
    currentUserIdRef.current = userId;
    if (previousUserIdRef.current !== userId) {
      previousUserIdRef.current = userId;
      setManualSyncNonce(0);
    }
  }, [session]);

  useEffect(() => {
    let active = true;
    const generationId = hydrationGenerationRef.current + 1;
    hydrationGenerationRef.current = generationId;
    hydratingRef.current = true;

    const fallbackDb = createOperationalFallbackDb(initialDb);
    const userId = session?.user?.id || null;
    const syncDisabled = shouldDisableSupabaseSync();
    const syncEnabled = shouldEnableSupabaseSync();
    const manualSyncRequested = manualSyncNonce > 0;
    const shouldAutoSync = syncEnabled;

    const shouldApply = () => {
      const isCurrentGeneration = hydrationGenerationRef.current === generationId;
      const sameUser = currentUserIdRef.current === userId;
      const validUser = Boolean(userId);
      return active && isCurrentGeneration && sameUser && validUser;
    };

    if (!hydrationEnabled || !userId) {
      setDbState(fallbackDb);
      setDataSource('signed_out');
      setDataError(null);
      setDataReady(true);
      hydratingRef.current = false;
      if (import.meta.env.DEV) {
        console.debug('[HERDON_DATA_BOOT]', {
          stage: 'skip_signed_out',
          generationId,
          hasUserId: Boolean(userId),
          hydrationEnabled,
          signedOutSkipped: true,
        });
      }
      return () => {
        active = false;
      };
    }

    if (syncDisabled) {
      setDbState(fallbackDb);
      setDataSource('offline_disabled');
      setDataError(null);
      setDataReady(true);
      hydratingRef.current = false;
      logSyncGuard({
        stage: 'sync_disabled_by_flag',
        generationId,
        hasUserId: true,
        flag: HERDON_DISABLE_SUPABASE_SYNC,
      });
      return () => {
        active = false;
      };
    }

    if (!manualSyncRequested && !shouldAutoSync) {
      setDbState(fallbackDb);
      setDataSource('local_offline');
      setDataError(null);
      setDataReady(true);
      hydratingRef.current = false;
      if (!autoSyncDisabledLogged && import.meta.env.DEV) {
        autoSyncDisabledLogged = true;
        console.debug('[HERDON_DATA_BOOT]', {
          stage: 'auto_sync_disabled_by_default',
          hasUserId: true,
        });
      }
      return () => {
        active = false;
      };
    }

    setDbState(fallbackDb);
    setDataSource('fallback');
    setDataError(null);
    setDataReady(true);
    logSyncGuard({
      stage: 'fallback_published',
      generationId,
      hasUserId: true,
      delayMs: HYDRATION_START_DELAY_MS,
    });

    const hydrationVersion = localMutationRef.current;
    const timer = globalThis.setTimeout(async () => {
      if (!shouldApply()) {
        logSyncGuard({
          stage: 'sync_cancelled_before_start',
          generationId,
          hasUserId: true,
        });
        return;
      }

      setDataSource('syncing');
      setDataError(null);
      logSyncGuard({
        stage: 'sync_started',
        generationId,
        hasUserId: true,
      });

      try {
        const readiness = await ensureSupabaseRequestReadiness(session, {
          stage: 'operational_hydration',
          action: 'select',
          table: 'operacional_snapshot',
        });
        if (!readiness.ok) {
          setDataSource('fallback_error');
          setDataError(new Error(readiness.message || 'Sincronizacao indisponivel no momento.'));
          return;
        }

        const snapshotResult = await loadOperationalSnapshot(userId, shouldApply, generationId);
        if (!shouldApply()) {
          logSyncGuard({
            stage: 'sync_result_ignored_stale',
            generationId,
            hasUserId: true,
          });
          return;
        }

        const canApplySnapshot = localMutationRef.current === hydrationVersion;
        if (!canApplySnapshot) {
          setDataSource('fallback');
          logSyncGuard({
            stage: 'sync_skipped_local_mutation',
            generationId,
            hasUserId: true,
          });
          return;
        }

        const snapshot = snapshotResult?.snapshot || {};
        setDbState(createOperationalFallbackDb(snapshot));
        if (snapshotResult?.circuitOpen) {
          setDataSource('offline_circuit_open');
          setDataError(new Error('Sincronizacao com a nuvem instavel. O app continuara em modo local.'));
        } else {
          setDataSource('supabase');
          setDataError(null);
          setLastSyncAt(new Date().toISOString());
        }
      } catch {
        if (!shouldApply()) {
          logSyncGuard({
            stage: 'sync_error_ignored_stale',
            generationId,
            hasUserId: true,
          });
          return;
        }
        setDataSource('fallback_error');
        setDataError(new Error('Sincronizacao instavel. Seus dados locais continuam disponiveis.'));
      } finally {
        if (hydrationGenerationRef.current === generationId) {
          hydratingRef.current = false;
        }
      }
    }, HYDRATION_START_DELAY_MS);

    return () => {
      active = false;
      globalThis.clearTimeout(timer);
      if (hydrationGenerationRef.current === generationId) {
        hydratingRef.current = false;
      }
      logSyncGuard({
        stage: 'sync_cancelled_cleanup',
        generationId,
        hasUserId: Boolean(userId),
      });
    };
  }, [hydrationEnabled, initialDb, manualSyncNonce, session]);

  return {
    db,
    setDb,
    dataReady,
    dataSource,
    dataError,
    lastSyncAt,
    hydratingRef,
    syncNow,
  };
}
