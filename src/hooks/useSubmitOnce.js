import { useCallback, useMemo, useState } from 'react';
import { criarTravaSubmissao } from '../utils/submitGuard.js';

/**
 * Envolve uma submissão assíncrona para evitar cadastro duplicado (7.2/7.3):
 * bloqueia reentrância enquanto está em andamento e expõe `isSubmitting` para
 * desabilitar o botão. A trava (useRef via criarTravaSubmissao) protege contra
 * duplo clique mesmo antes do re-render; o estado só cuida do visual.
 */
export function useSubmitOnce() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trava = useMemo(() => criarTravaSubmissao(), []);

  const executar = useCallback(async (action) => {
    if (trava.estaOcupado()) return undefined;
    setIsSubmitting(true);
    try {
      const { resultado } = await trava.executar(action);
      return resultado;
    } finally {
      setIsSubmitting(false);
    }
  }, [trava]);

  return { executar, isSubmitting };
}
