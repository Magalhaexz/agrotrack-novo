export default function FazendaCard({ fazenda, lotesVinculados = 0, onClick }) {
<<<<<<< HEAD
  if (!fazenda) return null;

  const area = fazenda.hectares ?? fazenda.area_total_ha ?? 0;
  const responsavel = fazenda.responsavel || fazenda.proprietario || '—';
  const localizacao = [fazenda.cidade, fazenda.estado].filter(Boolean).join(' / ') || '—';

  return (
    <article
      className="fazenda-card"
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalhes da fazenda ${fazenda.nome}`}
    >
      <div className="fazenda-card-header">
        <div>
          <div className="fazenda-card-nome">{fazenda.nome}</div>
          <div className="fazenda-card-local">{localizacao}</div>
=======
  return (
    <article className="fazenda-card" onClick={onClick}>
      <div className="fazenda-card-header">
        <div>
          <div className="fazenda-card-nome">{fazenda.nome}</div>
          <div className="fazenda-card-local">{fazenda.cidade} / {fazenda.estado}</div>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        </div>
      </div>

      <div className="fazenda-card-stats">
        <div>
          <div className="fazenda-stat-label">Hectares</div>
<<<<<<< HEAD
          <div className="fazenda-stat-value">{area} ha</div>
        </div>
        <div>
          <div className="fazenda-stat-label">Responsável</div>
          <div className="fazenda-stat-value">{responsavel}</div>
=======
          <div className="fazenda-stat-value">{fazenda.hectares || fazenda.area_total_ha || 0} ha</div>
        </div>
        <div>
          <div className="fazenda-stat-label">Responsável</div>
          <div className="fazenda-stat-value">{fazenda.responsavel || fazenda.proprietario || '—'}</div>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        </div>
        <div>
          <div className="fazenda-stat-label">Lotes</div>
          <div className="fazenda-stat-value">{lotesVinculados}</div>
        </div>
      </div>
    </article>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
