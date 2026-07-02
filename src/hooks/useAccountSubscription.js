import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAccountSubscription } from '../services/accessControl.js';

/**
 * Carrega a assinatura da conta (customer_subscriptions) direto da nuvem.
 * Essa tabela não participa do sync operacional local — é escrita apenas pelo
 * checkout/webhook Asaas ou pelo admin — então o gate comercial depende deste
 * hook, e não do db operacional.
 *
 * `loaded` só vira true depois da primeira resposta (sucesso ou erro), para o
 * App segurar o boot e não decidir bloqueio com dado incompleto.
 */
export function useAccountSubscription(session, { enabled = true } = {}) {
  const [state, setState] = useState({
    subscription: null,
    rows: [],
    loading: false,
    loaded: false,
    error: null,
  });
  const requestSeq = useRef(0);
  const userId = session?.user?.id || null;

  const refresh = useCallback(async () => {
    if (!enabled || !userId) return;
    const seq = ++requestSeq.current;
    setState((prev) => ({ ...prev, loading: true }));

    const result = await fetchAccountSubscription(session);
    if (seq !== requestSeq.current) return;

    setState({
      subscription: result.subscription,
      rows: result.rows,
      loading: false,
      loaded: true,
      error: result.error || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) {
      requestSeq.current += 1;
      setState({ subscription: null, rows: [], loading: false, loaded: !userId, error: null });
      return undefined;
    }

    void refresh();

    // Depois de um checkout o usuário volta do Asaas para o app: recarrega a
    // assinatura quando a aba recupera o foco, para refletir o webhook.
    function handleFocus() {
      void refresh();
    }

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [enabled, userId, refresh]);

  return { ...state, refresh };
}
