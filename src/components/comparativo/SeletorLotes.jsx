
const COR_FALLBACK = '#8884d8';

function obterCor(coresLotes, index) {
  if (!coresLotes?.length) return COR_FALLBACK;
  return coresLotes[index % coresLotes.length] || COR_FALLBACK;
}

export default function SeletorLotes({ lotes = [], selecionados = [], onToggle, coresLotes = [] }) {
  if (!lotes.length) return null;

  return (
    <div className="lote-toggle-list">
      {lotes.map((lote, i) => {
        const ativo = selecionados.includes(lote.id);

        const cor = obterCor(coresLotes, i);

        return (
          <button
            key={lote.id}
            type="button"
            className={`lote-toggle ${ativo ? 'active' : ''}`}

            style={{ '--lote-color': cor }}
            onClick={() => onToggle?.(lote.id)}
            aria-pressed={ativo}
            aria-label={`${ativo ? 'Desativar' : 'Ativar'} lote ${lote.nome}`}
          >
            <span
              className="lote-toggle-dot"
              style={{ background: cor }}
            />
            {lote.nome}
          </button>
        );
      })}
    </div>
  );

}
