import { useCallback, useEffect, useState } from 'react';
import { parseNavStateFromSearch, buildSearchFromNavState } from './urlState.js';

/**
 * Sincroniza um estado de sub-navegação (item selecionado, aba, filtros
 * leves) com a query string da URL — Seção 9/10 do sprint de fechamento.
 * Estratégia REUTILIZÁVEL: qualquer página com o padrão "lista → detalhe com
 * abas" usa este mesmo hook (hoje LotesPage; o mesmo padrão existe em
 * EstoquePage, CalendarioOperacionalPage, ResultadosPage e
 * MinhaAssinaturaPage — ainda não migradas, ver documentação do fechamento).
 *
 * @param {object} schema ex.: { loteId: 'number', tab: 'string' }
 * @param {object} defaults valor "vazio" de cada campo (nunca aparece na URL)
 * @param {string[]} pushFields campos que, ao mudar, empilham uma nova entrada
 *   de histórico (permitem "voltar" sair do item) — os demais usam
 *   replaceState (troca de aba não empilha histórico infinito).
 * @returns {[object, (patch: object) => void]}
 */
export function useUrlState(schema, defaults, pushFields = []) {
  const [state, setState] = useState(() => (
    typeof window === 'undefined'
      ? { ...defaults }
      : parseNavStateFromSearch(window.location.search, schema, defaults)
  ));

  useEffect(() => {
    function handlePopState() {
      setState(parseNavStateFromSearch(window.location.search, schema, defaults));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateState = useCallback((patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      const search = buildSearchFromNavState(next, defaults);
      const url = `${window.location.pathname}${search}`;
      const mudouCampoDePush = pushFields.some((campo) => campo in patch && patch[campo] !== prev[campo]);
      if (mudouCampoDePush) {
        window.history.pushState({}, '', url);
      } else {
        window.history.replaceState({}, '', url);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [state, updateState];
}
