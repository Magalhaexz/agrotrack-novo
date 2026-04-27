import { useEffect, useRef, useState } from 'react';
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

function isKnownOperationalModuleError(error) {
  const text = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return (
    code.startsWith('PGRST') ||
    text.includes('does not exist') ||
    text.includes('relation') ||
    text.includes('permission denied') ||
    text.includes('rls')
  );
}

async function loadOperationalSnapshot() {
  const entries = await Promise.all(
    OPERACIONAL_TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        throw error;
      }
      return [table, data];
    })
  );
  return Object.fromEntries(entries);
}

export function useOperationalData(initialDb, session) {
  const [db, setDb] = useState(() => createOperationalFallbackDb(initialDb));
  const [dataReady, setDataReady] = useState(false);
  const [dataSource, setDataSource] = useState('signed_out');
  const [dataError, setDataError] = useState(null);
  const hydratingRef = useRef(false);

  useEffect(() => {
    let ativo = true;
    hydratingRef.current = true;

    async function hydrate() {
      if (!session) {
        if (ativo) {
          setDb(createOperationalFallbackDb(initialDb));
          setDataSource('signed_out');
          setDataError(null);
          setDataReady(true);
        }
        return;
      }

      try {
        const timeoutPromise = new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('Operational load timeout after 8s')), 8000);
        });

        const snapshot = await Promise.race([loadOperationalSnapshot(), timeoutPromise]);

        if (ativo) {
          setDb(createOperationalFallbackDb(snapshot));
          setDataSource('supabase');
          setDataError(null);
          setDataReady(true);
        }
      } catch (error) {
        if (!ativo) return;

        if (String(error?.message || '').includes('timeout')) {
          if (import.meta.env.DEV) {
            console.warn('[HERDON_OPERATIONAL_TIMEOUT]', error);
          }
          setDb(createOperationalFallbackDb(initialDb));
          setDataSource('fallback_timeout');
          setDataError(error instanceof Error ? error : new Error('Falha por timeout na carga operacional.'));
          setDataReady(true);
          return;
        }

        setDb(createOperationalFallbackDb(initialDb));
        setDataSource(isKnownOperationalModuleError(error) ? 'fallback' : 'fallback_error');
        setDataError(error instanceof Error ? error : new Error('Falha ao carregar dados operacionais.'));
        setDataReady(true);
      } finally {
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

