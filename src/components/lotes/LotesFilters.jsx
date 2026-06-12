import Input from '../ui/Input';
import { PERIODO_OPTIONS, STATUS_OPTIONS } from './constants';

export default function LotesFilters({ filters, fazendaAtiva, onChange }) {
  return (
    <div className="section-card rebanho-filters-shell">
      <div className="section-header">
        <div>
          <h3>Filtros</h3>
          <p>Refine por status, período e busca. A fazenda ativa é aplicada automaticamente.</p>
        </div>
      </div>

      <div className="rebanho-filters form-grid two">
        <Input
          label="Busca"
          value={filters.busca || ''}
          onChange={(e) => onChange('busca', e.target.value)}
          placeholder="Buscar por nome do lote"
        />

        <Input as="select" label="Status" value={filters.status} onChange={(e) => onChange('status', e.target.value)}>
          {STATUS_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </Input>

        <div className="ui-input-wrap">
          <label className="ui-input-label">Fazenda ativa</label>
          <div className="ui-input-shell" style={{ minHeight: 48 }}>
            <span className="ui-input-affix">{fazendaAtiva?.nome || 'Selecione uma fazenda no topo da tela.'}</span>
          </div>
        </div>

        <Input as="select" label="Período" value={filters.periodo} onChange={(e) => onChange('periodo', e.target.value)}>
          {PERIODO_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </Input>
      </div>
    </div>
  );
}
