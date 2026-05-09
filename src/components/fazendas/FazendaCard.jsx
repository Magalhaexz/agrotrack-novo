export default function FazendaCard({ fazenda, lotesVinculados = 0, onClick, onDelete }) {
  if (!fazenda) return null;

  const area = Number(fazenda.hectares ?? fazenda.area_total_ha ?? 0);
  const capacidadeUa = Number(fazenda.capacidade_lotacao ?? fazenda.capacidade_ua ?? 0);
  const responsavel = fazenda.responsavel || fazenda.proprietario || '—';
  const localizacao = [fazenda.cidade, fazenda.estado].filter(Boolean).join(' / ') || '—';
  const status = String(fazenda?.status || 'ativa').toLowerCase();

  return (
    <article
      className="fazenda-card section-card"
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
        </div>
        <span className={`status-badge ${status === 'ativa' ? 'status-badge--ativo' : 'status-badge--inativo'}`}>
          {status}
        </span>
      </div>

      <div className="fazenda-card-stats">
        <div>
          <div className="fazenda-stat-label">Área</div>
          <div className="fazenda-stat-value">{area.toLocaleString('pt-BR')} ha</div>
        </div>
        <div>
          <div className="fazenda-stat-label">Responsável</div>
          <div className="fazenda-stat-value">{responsavel}</div>
        </div>
        <div>
          <div className="fazenda-stat-label">Lotes</div>
          <div className="fazenda-stat-value">{lotesVinculados}</div>
        </div>
        <div>
          <div className="fazenda-stat-label">Capacidade</div>
          <div className="fazenda-stat-value">{capacidadeUa > 0 ? `${capacidadeUa.toLocaleString('pt-BR')} UA` : '—'}</div>
        </div>
      </div>

      <div className="action-row fazenda-card-actions">
        <button type="button" className="ui-button ui-button--outline ui-button--sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClick?.(); }}>
          Ver detalhes
        </button>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClick?.(); }}>
          Editar
        </button>
        <button
          type="button"
          className="ui-button ui-button--danger ui-button--sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete?.();
          }}
          aria-label={`Excluir fazenda ${fazenda.nome}`}
        >
          Excluir
        </button>
      </div>
    </article>
  );
}
