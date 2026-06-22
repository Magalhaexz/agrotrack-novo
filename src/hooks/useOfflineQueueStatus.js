import { useCallback, useEffect, useState } from 'react';
import {
  QUEUE_UPDATED_EVENT,
  aplicarItemSincronizadoNoDb,
  isOnline,
  obterResumoFilaOffline,
  sincronizarFilaOffline,
  sincronizarItemDaFilaOffline,
} from '../services/offlineQueue.js';

/**
 * Estado reativo da fila do Modo Campo + conexão, para indicadores e o
 * painel de Sincronização. Não dispara sincronização automática por conta
 * própria — isso é responsabilidade de `useOfflineAutoSync`, montado uma
 * única vez no nível do App. Se `setDb` for informado, os registros
 * sincronizados pelos botões manuais desta tela também são refletidos no
 * `db` em memória imediatamente.
 */
export function useOfflineQueueStatus(session, setDb = null) {
  const [online, setOnline] = useState(() => isOnline());
  const [resumo, setResumo] = useState(() => obterResumoFilaOffline(session));
  const [sincronizando, setSincronizando] = useState(false);

  const atualizarResumo = useCallback(() => {
    setResumo(obterResumoFilaOffline(session));
  }, [session]);

  const onItemSynced = useCallback((item, data) => {
    setDb?.((prev) => aplicarItemSincronizadoNoDb(prev, item, data));
  }, [setDb]);

  const sincronizarAgora = useCallback(async () => {
    setSincronizando(true);
    try {
      const resultado = await sincronizarFilaOffline(session, { manual: true, onItemSynced });
      atualizarResumo();
      return resultado;
    } finally {
      setSincronizando(false);
    }
  }, [session, atualizarResumo, onItemSynced]);

  const sincronizarItemAgora = useCallback(async (idLocal) => {
    setSincronizando(true);
    try {
      const resultado = await sincronizarItemDaFilaOffline(idLocal, session, { onItemSynced });
      atualizarResumo();
      return resultado;
    } finally {
      setSincronizando(false);
    }
  }, [session, atualizarResumo, onItemSynced]);

  useEffect(() => {
    atualizarResumo();

    function handleOnline() { setOnline(true); }
    function handleOffline() { setOnline(false); }
    function handleQueueUpdated() { atualizarResumo(); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(QUEUE_UPDATED_EVENT, handleQueueUpdated);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(QUEUE_UPDATED_EVENT, handleQueueUpdated);
    };
  }, [atualizarResumo]);

  return {
    online,
    pendentes: resumo.pendentes,
    sincronizados: resumo.sincronizados,
    comErro: resumo.comErro,
    itens: resumo.itens,
    sincronizando,
    sincronizarAgora,
    sincronizarItemAgora,
    atualizarResumo,
  };
}
