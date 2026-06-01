import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const OPERACIONAL_TABLES = [
  'fazendas',
  'lotes',
  'pastagens',
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
  'alertas_adiados',
  'usuarios',
  'configuracoes',
  'cenarios',
];

const OWNER_SCOPED_TABLES = new Set(OPERACIONAL_TABLES);
const HYDRATION_CONCURRENCY_LIMIT = 3;
const HYDRATION_MAX_ATTEMPTS = 2;
const HYDRATION_BACKOFF_MS = 350;
const HYDRATION_START_DELAY_MS = 1800;
const HYDRATION_FAILURE_COOLDOWN_MS = 45000;
const HYDRATION_FAILURES_TO_OPEN_CIRCUIT = 4;
const MANUAL_SYNC_TIMEOUT_MS = 15000;
const HERDON_DISABLE_SUPABASE_SYNC = 'HERDON_DISABLE_SUPABASE_SYNC';
const inFlightSnapshots = new Map();
const failedHydrationAt = new Map();
const schemaWarningTables = new Set();
const ownerScopeCapabilityByTable = new Map();

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function wait(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function withTimeout(promise, timeoutMs, timeoutMessage = 'sync_timeout') {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      });
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


function logSyncGuard(payload, level = 'debug') {
  if (!import.meta.env.DEV) return;
  const logger = level === 'warn' ? console.warn : console.debug;
  logger('[HERDON_SYNC_GUARD]', payload);
}

function normalizeDb(baseDb) {
  const dedupeFazendas = (rows = []) => {
    const map = new Map();
    const getIdentity = (row) => {
      const cloudId = row?.id;
      const externalCloudId = row?.cloud_id || row?.metadata?.cloud_id || null;
      const localId = row?.metadata?.local_id ?? null;
      const fallbackKey = `${String(row?.nome || '').trim().toLowerCase()}|${String(row?.cidade || '').trim().toLowerCase()}|${String(row?.estado || '').trim().toLowerCase()}`;
      if (cloudId !== undefined && cloudId !== null && cloudId !== '') return `id:${cloudId}`;
      if (externalCloudId) return `cloud:${externalCloudId}`;
      if (localId !== null && localId !== undefined && localId !== '') return `local:${localId}`;
      return `fallback:${fallbackKey}`;
    };
    const scoreRow = (row) => {
      const hasCloudIdentity = Boolean(
        (row?.id !== undefined && row?.id !== null && row?.id !== '')
        || row?.cloud_id
        || row?.metadata?.cloud_id
      );
      const updatedAtScore = Date.parse(row?.updated_at || row?.created_at || 0) || 0;
      return {
        hasCloudIdentity,
        updatedAtScore,
        stableText: JSON.stringify({
          id: row?.id ?? null,
          cloud_id: row?.cloud_id ?? row?.metadata?.cloud_id ?? null,
          local_id: row?.metadata?.local_id ?? null,
          nome: String(row?.nome || ''),
          cidade: String(row?.cidade || ''),
          estado: String(row?.estado || ''),
        }),
      };
    };

    rows.forEach((row) => {
      const key = getIdentity(row);
      if (!map.has(key)) {
        map.set(key, row);
        return;
      }
      const current = map.get(key);
      const currentScore = scoreRow(current);
      const nextScore = scoreRow(row);
      if (nextScore.hasCloudIdentity && !currentScore.hasCloudIdentity) {
        map.set(key, row);
        return;
      }
      if (nextScore.updatedAtScore > currentScore.updatedAtScore) {
        map.set(key, row);
        return;
      }
      if (nextScore.updatedAtScore === currentScore.updatedAtScore && nextScore.stableText > currentScore.stableText) {
        map.set(key, row);
      }
    });
    return [...map.values()];
  };
  return {
    ...baseDb,
    alertas_resolvidos: Array.isArray(baseDb?.alertas_resolvidos) ? baseDb.alertas_resolvidos : [],
    alertas_adiados: Array.isArray(baseDb?.alertas_adiados) ? baseDb.alertas_adiados : [],
    funcionarios: Array.isArray(baseDb?.funcionarios) ? baseDb.funcionarios : [],
    lotes: Array.isArray(baseDb?.lotes)
      ? baseDb.lotes.map((lote) => ({
          ...lote,
          status: lote?.status || 'ativo',
          data_encerramento: lote?.data_encerramento || null,
          data_venda: lote?.data_venda || null,
        }))
      : [],
    pastagens: Array.isArray(baseDb?.pastagens) ? baseDb.pastagens : [],
    fazendas: Array.isArray(baseDb?.fazendas) ? dedupeFazendas(baseDb.fazendas) : [],
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
    cenarios: Array.isArray(baseDb?.cenarios) ? baseDb.cenarios : [],
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
      const tableOwnerScope = ownerScopeCapabilityByTable.has(table)
        ? ownerScopeCapabilityByTable.get(table)
        : OWNER_SCOPED_TABLES.has(table);
      const runSelect = async (useOwnerScope) => {
        let query = supabase.from(table).select('*');
        if (useOwnerScope) query = query.eq('owner_user_id', userId);
        return query;
      };
      let { data, error } = await runSelect(Boolean(tableOwnerScope));
      const errMessage = String(getErrorMessage(error) || '').toLowerCase();
      const ownerColumnMissing = Boolean(
        error
        && (error?.code === '42703' || error?.code === 'PGRST204' || errMessage.includes('owner_user_id'))
      );
      if (error && tableOwnerScope && ownerColumnMissing) {
        ownerScopeCapabilityByTable.set(table, false);
        ({ data, error } = await runSelect(false));
      }
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
      circuitState.hadFailures = true;
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
  circuitState.hadFailures = true;
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

  const circuitState = { failures: 0, open: false, hadFailures: false };
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
    hadFailures: circuitState.hadFailures,
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
  const [manualSyncInFlight, setManualSyncInFlight] = useState(false);
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
    if (hydratingRef.current || manualSyncInFlight) {
      logSyncGuard({
        stage: 'manual_sync_ignored_already_syncing',
        action: 'manual_sync',
        status: 'ignored',
      });
      return false;
    }
    setManualSyncNonce((value) => value + 1);
    return true;
  }, [manualSyncInFlight]);

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
    const manualSyncRequested = manualSyncNonce > 0;
    const syncTrigger = manualSyncRequested ? 'manual_sync' : 'auto_sync';

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

    setDbState(fallbackDb);
      setDataSource('fallback');
      setDataError(null);
      setDataReady(true);
      setManualSyncInFlight(false);
      logSyncGuard({
        stage: manualSyncRequested ? 'fallback_published' : 'auto_sync_bootstrap',
        action: syncTrigger,
        status: 'fallback_ready',
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
      setManualSyncInFlight(true);
      logSyncGuard({
        stage: 'sync_started',
        action: syncTrigger,
        status: 'syncing',
        generationId,
        hasUserId: true,
      });

      try {
        const snapshotResult = await withTimeout(
          loadOperationalSnapshot(userId, shouldApply, generationId),
          MANUAL_SYNC_TIMEOUT_MS,
          'snapshot_timeout'
        );
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
            action: syncTrigger,
            status: 'local_mutation_detected',
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
          logSyncGuard({
            stage: 'sync_finished_circuit_open',
            action: syncTrigger,
            status: 'error',
            errorName: 'CIRCUIT_OPEN',
            errorMessage: 'Sincronizacao com a nuvem instavel. O app continuara em modo local.',
          }, 'warn');
        } else if (snapshotResult?.hadFailures) {
          setDataSource('fallback_error');
          setDataError(new Error('A nuvem apresentou falhas nesta sincronizacao. O app segue em dados locais.'));
          logSyncGuard({
            stage: 'sync_finished_partial_failure',
            action: syncTrigger,
            status: 'error',
            errorName: 'PARTIAL_SYNC_FAILURE',
            errorMessage: 'A nuvem apresentou falhas nesta sincronizacao. O app segue em dados locais.',
          }, 'warn');
        } else {
          setDataSource('supabase');
          setDataError(null);
          setLastSyncAt(new Date().toISOString());
          logSyncGuard({
            stage: 'sync_finished_success',
            action: 'manual_sync',
            status: 'success',
          });
        }
      } catch (error) {
        if (!shouldApply()) {
          logSyncGuard({
            stage: 'sync_error_ignored_stale',
            generationId,
            hasUserId: true,
          });
          return;
        }
        const errorName = error?.name || 'SYNC_ERROR';
        const rawMessage = getErrorMessage(error);
        const isTimeout = errorName === 'TimeoutError' || rawMessage === 'snapshot_timeout';
        setDataSource(isTimeout ? 'fallback_timeout' : 'offline_circuit_open');
        setDataError(new Error(isTimeout
          ? 'Sincronizacao demorou mais que o esperado. O app segue em modo local.'
          : 'Sincronizacao instavel. Seus dados locais continuam disponiveis.'));
        logSyncGuard({
          stage: 'sync_finished_exception',
          action: syncTrigger,
          status: 'error',
          errorName,
          errorMessage: rawMessage || 'unknown_error',
        }, 'warn');
      } finally {
        setManualSyncInFlight(false);
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
      setManualSyncInFlight(false);
      logSyncGuard({
        stage: 'sync_cancelled_cleanup',
        action: syncTrigger,
        status: 'cancelled',
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
    manualSyncInFlight,
    hydratingRef,
    syncNow,
  };
}
