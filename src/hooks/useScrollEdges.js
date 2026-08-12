import { useEffect, useRef, useState } from 'react';

// Sprint Visual 5 (tabelas densas): indicador de scroll horizontal — mede de
// verdade se um container tem mais conteúdo pra rolar à esquerda/direita
// (scrollWidth/scrollLeft/clientWidth), em vez de assumir. Usado para
// mostrar/esconder o fade lateral (.ui-table-fade, ver ui.css) só quando
// existe overflow real, e escondê-lo sozinho ao chegar no início/fim.
// `deps` deve incluir o que muda a largura do conteúdo (linhas, colunas).
export default function useScrollEdges(deps) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    function medir() {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setEdges({
        left: scrollLeft > 1,
        right: scrollLeft + clientWidth < scrollWidth - 1,
      });
    }

    medir();
    el.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => {
      el.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
    };
  // `deps` é o array de dependências do próprio chamador (hook genérico) —
  // não dá pra verificar estaticamente, é o comportamento pretendido.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [ref, edges];
}
