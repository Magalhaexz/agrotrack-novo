import { useEffect } from 'react';
import { QUEUE_UPDATED_EVENT, aplicarItemSincronizadoNoDb, sincronizarFilaOffline } from '../services/offlineQueue.js';

/**
 * Sincronização automática do Modo Campo: tenta enviar a fila quando a
 * internet volta ou quando a fila muda, e mescla os registros sincronizados
 * no `db` em memória para que o resto do app reflita sem precisar recarregar
 * a página. Mesmo padrão de retry com debounce já usado para a fila legada
 * em App.jsx.
 */
export function useOfflineAutoSync(session, setDb) {
  useEffect(() => {
    let retryTimer = null;

    async function runSync() {
      if (!session?.user?.id) return;
      await sincronizarFilaOffline(session, {
        onItemSynced: (item, data) => setDb?.((prev) => aplicarItemSincronizadoNoDb(prev, item, data)),
      });
    }

    function scheduleSync(delayMs) {
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        void runSync();
      }, delayMs);
    }

    function handleOnline() { scheduleSync(1500); }
    function handleQueueUpdated() { scheduleSync(2500); }

    if (session?.user?.id) scheduleSync(2000);
    window.addEventListener('online', handleOnline);
    window.addEventListener(QUEUE_UPDATED_EVENT, handleQueueUpdated);
    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(QUEUE_UPDATED_EVENT, handleQueueUpdated);
    };
  }, [session, setDb]);
}
