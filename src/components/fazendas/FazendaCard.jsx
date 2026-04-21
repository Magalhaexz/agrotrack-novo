export default function FazendaCard({ fazenda, lotesVinculados = 0, onClick }) {
  return (
    <article className="fazenda-card" onClick={onClick}>
      <div className="fazenda-card-header">
        <div>
          <div className="fazenda-card-nome">{fazenda.nome}</div>
          <div className="fazenda-card-local">{fazenda.cidade} / {fazenda.estado}</div>
        </div>
      </div>

      <div className="fazenda-card-stats">
        <div>
          <div className="fazenda-stat-label">Hectares</div>
          <div className="fazenda-stat-value">{fazenda.hectares || fazenda.area_total_ha || 0} ha</div>
        </div>
        <div>
          <div className="fazenda-stat-label">Responsável</div>
          <div className="fazenda-stat-value">{fazenda.responsavel || fazenda.proprietario || '—'}</div>
        </div>
        <div>
          <div className="fazenda-stat-label">Lotes</div>
          <div className="fazenda-stat-value">{lotesVinculados}</div>
        </div>
      </div>
    </article>
  );
}
