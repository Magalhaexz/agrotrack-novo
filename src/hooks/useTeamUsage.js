import { useCallback, useEffect, useRef, useState } from 'react';
import { listInvites, listProfiles, isAccessModuleUnavailable } from '../services/userAccess.js';
import { contarUsuariosDoPlano } from '../domain/equipe.js';

/**
 * Quantos "assentos" de usuário a conta já usa, para o resumo de uso do
 * plano (Sprint 7). `profiles`/`invites` não fazem parte do sync operacional
 * local (mesmo motivo de `useAccountSubscription.js` para `customer_subscriptions`)
 * — por isso este hook busca direto da nuvem, e não do `db`.
 *
 * `loaded` só vira true após a primeira resposta; até lá, quem usa este hook
 * deve manter o número anterior (ex.: contagem antiga de `db.usuarios`) em
 * vez de mostrar 0 por um instante.
 */
export function useTeamUsage(session, { enabled = true } = {}) {
  const [state, setState] = useState({ activeUsers: null, loading: false, loaded: false, error: null });
  const requestSeq = useRef(0);
  const userId = session?.user?.id || null;

  const refresh = useCallback(async () => {
    if (!enabled || !userId) return;
    const seq = ++requestSeq.current;
    setState((prev) => ({ ...prev, loading: true }));

    const [profilesResponse, invitesResponse] = await Promise.all([listProfiles(), listInvites()]);
    if (seq !== requestSeq.current) return;

    const erro = profilesResponse.error || invitesResponse.error;
    if (erro) {
      setState({ activeUsers: null, loading: false, loaded: true, error: isAccessModuleUnavailable(erro) ? null : erro });
      return;
    }

    setState({
      activeUsers: contarUsuariosDoPlano({ profiles: profilesResponse.data || [], invites: invitesResponse.data || [] }),
      loading: false,
      loaded: true,
      error: null,
    });
  }, [enabled, userId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!enabled || !userId) {
      requestSeq.current += 1;
      setState({ activeUsers: null, loading: false, loaded: false, error: null });
      return undefined;
    }
    void refresh();
  }, [enabled, userId, refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { ...state, refresh };
}
