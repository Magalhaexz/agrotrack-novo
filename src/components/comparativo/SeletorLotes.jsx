<<<<<<< HEAD
const COR_FALLBACK = '#8884d8';

function obterCor(coresLotes, index) {
  if (!coresLotes?.length) return COR_FALLBACK;
  return coresLotes[index % coresLotes.length] || COR_FALLBACK;
}

export default function SeletorLotes({ lotes = [], selecionados = [], onToggle, coresLotes = [] }) {
  if (!lotes.length) return null;

=======
export default function SeletorLotes({ lotes = [], selecionados = [], onToggle, coresLotes = [] }) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  return (
    <div className="lote-toggle-list">
      {lotes.map((lote, i) => {
        const ativo = selecionados.includes(lote.id);
<<<<<<< HEAD
        const cor = obterCor(coresLotes, i);

=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        return (
          <button
            key={lote.id}
            type="button"
            className={`lote-toggle ${ativo ? 'active' : ''}`}
<<<<<<< HEAD
            style={{ '--lote-color': cor }}
            onClick={() => onToggle?.(lote.id)}
            aria-pressed={ativo}
            aria-label={`${ativo ? 'Desativar' : 'Ativar'} lote ${lote.nome}`}
          >
            <span
              className="lote-toggle-dot"
              style={{ background: cor }}
            />
=======
            style={{ '--lote-color': coresLotes[i % coresLotes.length] }}
            onClick={() => onToggle(lote.id)}
          >
            <span className="lote-toggle-dot" style={{ background: coresLotes[i % coresLotes.length] }} />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            {lote.nome}
          </button>
        );
      })}
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
