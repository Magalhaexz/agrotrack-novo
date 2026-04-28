import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

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
const HYDRATION_MAX_ATTEMPTS = 3;
const HYDRATION_BACKOFF_MS = 250;
const inFlightSnapshots = new Map();

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

function logHydrationDebug(payload, level = 'debug') {
  if (!import.meta.env.DEV) return;
  const logger = level === 'warn' ? console.warn : console.debug;
  logger('[HERDON_SUPABASE_HYDRATION]', payload);
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

async function fetchOperationalTable(table, userId) {
  for (let attempt = 1; attempt <= HYDRATION_MAX_ATTEMPTS; attempt += 1) {
    const startedAt = nowMs();
    try {
      let query = supabase.from(table).select('*');
      if (OWNER_SCOPED_TABLES.has(table)) {
        query = query.eq('owner_user_id', userId);
      }
      const { data, error } = await query;
      const durationMs = Number((nowMs() - startedAt).toFixed(1));

      if (error) {
        throw error;
      }

      logHydrationDebug({
        table,
        attempt,
        status: 'success',
        durationMs,
        dataSource: 'supabase',
        rowCount: Array.isArray(data) ? data.length : 0,
      });
      return [table, Array.isArray(data) ? data : []];
    } catch (error) {
      const durationMs = Number((nowMs() - startedAt).toFixed(1));
      const transient = isTransientHydrationError(error);
      const finalAttempt = attempt >= HYDRATION_MAX_ATTEMPTS || !transient;
      const message = getErrorMessage(error) || 'Falha ao carregar tabela operacional.';

      logHydrationDebug({
        table,
        attempt,
        status: finalAttempt ? 'failure_final' : 'failure_retrying',
        durationMs,
        transient,
        dataSource: finalAttempt ? 'fallback_table' : 'retry',
        message,
      }, finalAttempt ? 'warn' : 'debug');

      if (finalAttempt) {
        return [table, []];
      }

      await wait(HYDRATION_BACKOFF_MS * attempt);
    }
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

async function loadOperationalSnapshotRequest(session) {
  const userId = session?.user?.id;
  if (!userId) {
    return {};
  }

  const bootStart = nowMs();
  if (import.meta.env.DEV) {
    console.debug('[HERDON_DATA_BOOT]', {
      stage: 'snapshot_start',
      tables: OPERACIONAL_TABLES.length,
      concurrencyLimit: HYDRATION_CONCURRENCY_LIMIT,
    });
  }

  const entries = await runWithConcurrency(
    OPERACIONAL_TABLES,
    HYDRATION_CONCURRENCY_LIMIT,
    (table) => fetchOperationalTable(table, userId)
  );

  if (import.meta.env.DEV) {
    console.debug('[HERDON_DATA_BOOT]', {
      stage: 'snapshot_complete',
      durationMs: Number((nowMs() - bootStart).toFixed(1)),
      finalDataSource: 'supabase',
    });
  }

  return Object.fromEntries(entries);
}

async function loadOperationalSnapshot(session) {
  const userId = session?.user?.id;
  if (!userId) {
    return {};
  }

  const inFlight = inFlightSnapshots.get(userId);
  if (inFlight) {
    if (import.meta.env.DEV) {
      console.debug('[HERDON_DATA_BOOT]', {
        stage: 'snapshot_reuse_in_flight',
        finalDataSource: 'syncing',
      });
    }
    return inFlight;
  }

  const request = loadOperationalSnapshotRequest(session).finally(() => {
    if (inFlightSnapshots.get(userId) === request) {
      inFlightSnapshots.delete(userId);
    }
  });
  inFlightSnapshots.set(userId, request);
  return request;
}

export function useOperationalData(initialDb, session) {
  const [db, setDbState] = useState(() => createOperationalFallbackDb(initialDb));
  const [dataReady, setDataReady] = useState(true);
  const [dataSource, setDataSource] = useState('signed_out');
  const [dataError, setDataError] = useState(null);
  const hydratingRef = useRef(false);
  const hydrationIdRef = useRef(0);
  const localMutationRef = useRef(0);

  const setDb = useCallback((updater) => {
    localMutationRef.current += 1;
    setDbState(updater);
  }, []);

  useEffect(() => {
    let ativo = true;
    const hydrationId = hydrationIdRef.current + 1;
    hydrationIdRef.current = hydrationId;
    hydratingRef.current = true;

    const isCurrentHydration = () => ativo && hydrationIdRef.current === hydrationId;

    async function hydrate() {
      const hydrateStart = nowMs();
      if (!session) {
        if (isCurrentHydration()) {
          setDbState(createOperationalFallbackDb(initialDb));
          setDataSource('signed_out');
          setDataError(null);
          setDataReady(true);
        }
        return;
      }

      const fallbackStart = nowMs();
      const hydrationVersion = localMutationRef.current;
      if (isCurrentHydration()) {
        setDbState(createOperationalFallbackDb(initialDb));
        setDataSource('fallback');
        setDataError(null);
        setDataReady(true);
      }
      if (import.meta.env.DEV) {
        const fallbackEnd = nowMs();
        console.debug('[HERDON_DATA_TIMING]', {
          stage: 'fallback_ready',
          durationMs: Number((fallbackEnd - fallbackStart).toFixed(1)),
          transitionTo: 'fallback',
        });
      }

      try {
        const snapshotStart = nowMs();
        const loadPromise = loadOperationalSnapshot(session);

        if (isCurrentHydration()) {
          setDataSource('syncing');
        }

        const raceResult = await Promise.race([
          loadPromise.then(
            (snapshot) => ({ snapshot }),
            (error) => ({ error })
          ),
          new Promise((resolve) => {
            globalThis.setTimeout(() => resolve({ timeout: true }), 4500);
          }),
        ]);

        if (!isCurrentHydration()) return;

        if (raceResult?.timeout) {
          setDataSource('fallback_timeout');
          setDataError(new Error('Tempo limite na carga operacional (4.5s).'));
          setDataReady(true);
          if (import.meta.env.DEV) {
            const snapshotEnd = nowMs();
            console.debug('[HERDON_DATA_TIMING]', {
              stage: 'snapshot_timeout',
              durationMs: Number((snapshotEnd - snapshotStart).toFixed(1)),
              transitionTo: 'fallback_timeout',
            });
          }

          loadPromise
            .then((lateSnapshot) => {
              if (!isCurrentHydration()) return;
              const lateEnd = nowMs();
              const canApplyLateSnapshot = localMutationRef.current === hydrationVersion;
              if (canApplyLateSnapshot) {
                setDbState(createOperationalFallbackDb(lateSnapshot));
                setDataSource('supabase_late');
                setDataError(null);
                setDataReady(true);
              }
              if (import.meta.env.DEV) {
                console.debug('[HERDON_DATA_TIMING]', {
                  stage: canApplyLateSnapshot ? 'supabase_late' : 'supabase_late_skipped_local_changes',
                  durationMs: Number((lateEnd - snapshotStart).toFixed(1)),
                  transitionTo: canApplyLateSnapshot ? 'supabase_late' : 'fallback_timeout',
                });
              }
            })
            .catch((lateError) => {
              if (import.meta.env.DEV) {
                console.warn('[HERDON_OPERATIONAL_LATE_ERROR]', lateError);
              }
            });
          return;
        }

        if (raceResult?.error) {
          throw raceResult.error;
        }

        const canApplySnapshot = localMutationRef.current === hydrationVersion;
        if (canApplySnapshot) {
          setDbState(createOperationalFallbackDb(raceResult?.snapshot));
          setDataSource('supabase');
          setDataError(null);
          setDataReady(true);
        } else {
          setDataSource('fallback');
        }
        if (import.meta.env.DEV) {
          const snapshotEnd = nowMs();
          console.debug('[HERDON_DATA_TIMING]', {
            stage: canApplySnapshot ? 'supabase' : 'supabase_skipped_local_changes',
            durationMs: Number((snapshotEnd - snapshotStart).toFixed(1)),
            transitionTo: canApplySnapshot ? 'supabase' : 'fallback',
          });
        }
      } catch (error) {
        if (!isCurrentHydration()) return;

        const snapshotEnd = nowMs();
        setDataSource('fallback_error');
        setDataError(error instanceof Error ? error : new Error('Falha ao carregar dados operacionais.'));
        setDataReady(true);
        if (import.meta.env.DEV) {
          console.debug('[HERDON_DATA_TIMING]', {
            stage: 'snapshot_error',
            durationMs: Number((snapshotEnd - hydrateStart).toFixed(1)),
            transitionTo: 'fallback_error',
          });
        }
      } finally {
        if (import.meta.env.DEV) {
          const hydrateEnd = nowMs();
          console.debug('[HERDON_DATA_TIMING]', {
            stage: 'hydrate_finally',
            durationMs: Number((hydrateEnd - hydrateStart).toFixed(1)),
            hydrationId,
          });
        }
        if (hydrationIdRef.current === hydrationId) {
          hydratingRef.current = false;
        }
        if (isCurrentHydration()) {
          setDataReady((prev) => prev || true);
        }
      }
    }

    hydrate();

    return () => {
      ativo = false;
      if (hydrationIdRef.current === hydrationId) {
        hydratingRef.current = false;
      }
    };
  }, [initialDb, session]);

  return {
    db,
    setDb,
    dataReady,
    dataSource,
    dataError,
    hydratingRef,
  };
}
