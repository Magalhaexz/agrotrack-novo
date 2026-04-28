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

async function loadOperationalSnapshot(session) {
  const userId = session?.user?.id;
  if (!userId) {
    return {};
  }

  const entries = await Promise.all(
    OPERACIONAL_TABLES.map(async (table) => {
      let query = supabase.from(table).select('*');
      if (OWNER_SCOPED_TABLES.has(table)) {
        query = query.eq('owner_user_id', userId);
      }
      const { data, error } = await query;
      if (error) {
        if (import.meta.env.DEV) {
          console.warn('[HERDON_OPERATIONAL_TABLE_ERROR]', { table, message: error.message });
        }
        return [table, []];
      }
      return [table, data];
    })
  );
  return Object.fromEntries(entries);
}

export function useOperationalData(initialDb, session) {
  const [db, setDbState] = useState(() => createOperationalFallbackDb(initialDb));
  const [dataReady, setDataReady] = useState(true);
  const [dataSource, setDataSource] = useState('signed_out');
  const [dataError, setDataError] = useState(null);
  const hydratingRef = useRef(false);
  const localMutationRef = useRef(0);

  const setDb = useCallback((updater) => {
    localMutationRef.current += 1;
    setDbState(updater);
  }, []);

  useEffect(() => {
    let ativo = true;
    hydratingRef.current = true;

    async function hydrate() {
      const hydrateStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!session) {
        if (ativo) {
          setDbState(createOperationalFallbackDb(initialDb));
          setDataSource('signed_out');
          setDataError(null);
          setDataReady(true);
        }
        return;
      }

      const fallbackStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const hydrationVersion = localMutationRef.current;
      if (ativo) {
        setDbState(createOperationalFallbackDb(initialDb));
        setDataSource('fallback');
        setDataError(null);
        setDataReady(true);
      }
      if (import.meta.env.DEV) {
        const fallbackEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
        console.debug('[HERDON_DATA_TIMING]', {
          stage: 'fallback_ready',
          durationMs: Number((fallbackEnd - fallbackStart).toFixed(1)),
          transitionTo: 'fallback',
        });
      }

      try {
        const snapshotStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const loadPromise = loadOperationalSnapshot(session);

        if (ativo) {
          setDataSource('syncing');
        }

        const raceResult = await Promise.race([
          loadPromise.then((snapshot) => ({ snapshot })),
          loadPromise.catch((error) => ({ error })),
          new Promise((resolve) => {
            window.setTimeout(() => resolve({ timeout: true }), 4500);
          }),
        ]);

        if (!ativo) return;

        if (raceResult?.timeout) {
          setDataSource('fallback_timeout');
          setDataError(new Error('Tempo limite na carga operacional (4.5s).'));
          setDataReady(true);
          if (import.meta.env.DEV) {
            const snapshotEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
            console.debug('[HERDON_DATA_TIMING]', {
              stage: 'snapshot_timeout',
              durationMs: Number((snapshotEnd - snapshotStart).toFixed(1)),
              transitionTo: 'fallback_timeout',
            });
          }

          loadPromise
            .then((lateSnapshot) => {
              if (!ativo) return;
              const lateEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
          const snapshotEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
          console.debug('[HERDON_DATA_TIMING]', {
            stage: canApplySnapshot ? 'supabase' : 'supabase_skipped_local_changes',
            durationMs: Number((snapshotEnd - snapshotStart).toFixed(1)),
            transitionTo: canApplySnapshot ? 'supabase' : 'fallback',
          });
        }
      } catch (error) {
        if (!ativo) return;

        const snapshotEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
          const hydrateEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
          console.debug('[HERDON_DATA_TIMING]', {
            stage: 'hydrate_finally',
            durationMs: Number((hydrateEnd - hydrateStart).toFixed(1)),
            source: dataSource,
          });
        }
        hydratingRef.current = false;
        if (ativo) {
          setDataReady((prev) => prev || true);
        }
      }
    }

    hydrate();

    return () => {
      ativo = false;
      hydratingRef.current = false;
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
