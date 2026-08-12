import useScrollEdges from '../../hooks/useScrollEdges';

// Sprint Visual 5 (tabelas densas): envolve um container de scroll horizontal
// já existente (ex.: <div className="table-responsive">) com o fade lateral
// compartilhado (ver .ui-table-outer/.ui-table-fade em ui.css) sem mudar
// nada do conteúdo/estilo interno da tabela. Uso:
//   <TableScrollFade className="table-responsive" watch={rows}>
//     <table className="data-table">...</table>
//   </TableScrollFade>
// `watch` deve ser algo que muda quando a largura do conteúdo muda (ex.: a
// lista de linhas) — o fade remede o overflow real quando isso mudar.
export default function TableScrollFade({ className = '', watch, children }) {
  const [scrollRef, edges] = useScrollEdges([watch]);
  const outerClass = [
    'ui-table-outer',
    edges.left && 'can-scroll-left',
    edges.right && 'can-scroll-right',
  ].filter(Boolean).join(' ');

  return (
    <div className={outerClass}>
      <span className="ui-table-fade ui-table-fade--left" aria-hidden="true" />
      <span className="ui-table-fade ui-table-fade--right" aria-hidden="true" />
      <div className={className} ref={scrollRef}>
        {children}
      </div>
    </div>
  );
}
