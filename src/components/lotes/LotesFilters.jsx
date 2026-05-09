import Input from '../ui/Input';
import { PERIODO_OPTIONS, STATUS_OPTIONS } from './constants';

export default function LotesFilters({ filters, fazendas, onChange }) {
  return (
    <div className="section-card rebanho-filters-shell">
      <div className="section-header">
        <div>
          <h3>Filtros</h3>
          <p>Refine por fazenda, status, período e busca.</p>
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

        <Input as="select" label="Fazenda" value={filters.fazenda} onChange={(e) => onChange('fazenda', e.target.value)}>
          <option value="todas">Todas as fazendas</option>
          {fazendas.map((fazenda) => (
            <option key={fazenda.id} value={String(fazenda.id)}>{fazenda.nome}</option>
          ))}
        </Input>

        <Input as="select" label="Período" value={filters.periodo} onChange={(e) => onChange('periodo', e.target.value)}>
          {PERIODO_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </Input>
      </div>
    </div>
  );
}
