export default function SeletorLotes({ lotes = [], selecionados = [], onToggle, coresLotes = [] }) {
  return (
    <div className="lote-toggle-list">
      {lotes.map((lote, i) => {
        const ativo = selecionados.includes(lote.id);
        return (
          <button
            key={lote.id}
            type="button"
            className={`lote-toggle ${ativo ? 'active' : ''}`}
            style={{ '--lote-color': coresLotes[i % coresLotes.length] }}
            onClick={() => onToggle(lote.id)}
          >
            <span className="lote-toggle-dot" style={{ background: coresLotes[i % coresLotes.length] }} />
            {lote.nome}
          </button>
        );
      })}
    </div>
  );
}
