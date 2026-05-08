import { PERIODO_OPTIONS, STATUS_OPTIONS } from './constants';

export default function LotesFilters({ filters, fazendas, onChange }) {
  return (
    <div className="rebanho-filters">
      <select className="ui-input" value={filters.status} onChange={(e) => onChange('status', e.target.value)}>
        {STATUS_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>

      <select className="ui-input" value={filters.fazenda} onChange={(e) => onChange('fazenda', e.target.value)}>
        <option value="todas">Todas as fazendas</option>
        {fazendas.map((fazenda) => (
          <option key={fazenda.id} value={String(fazenda.id)}>{fazenda.nome}</option>
        ))}
      </select>

      <select className="ui-input" value={filters.periodo} onChange={(e) => onChange('periodo', e.target.value)}>
        {PERIODO_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    </div>
  );
}
