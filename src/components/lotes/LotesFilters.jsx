import { X } from 'lucide-react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { PERIODO_OPTIONS, STATUS_OPTIONS } from './constants';

const FILTROS_PADRAO = { status: 'todos', periodo: 'todos', busca: '' };

// Sprint Visual 5: barra compacta (busca + status + período + limpar).
// O seletor de fazenda já existe no topo do app — este componente nunca
// duplicou um segundo seletor, só mostrava a fazenda ativa como texto; esse
// texto foi para o cabeçalho da página (LotesPageHeader), então some daqui.
export default function LotesFilters({ filters, onChange, onClear }) {
  const filtrosAtivos = (
    (filters.status && filters.status !== FILTROS_PADRAO.status)
    || (filters.periodo && filters.periodo !== FILTROS_PADRAO.periodo)
    || Boolean(String(filters.busca || '').trim())
  );

  return (
    <div className="section-card rebanho-filters-shell">
      <div className="rebanho-filters-bar">
        <Input
          className="rebanho-filters-search"
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

        <Input as="select" label="Período" value={filters.periodo} onChange={(e) => onChange('periodo', e.target.value)}>
          {PERIODO_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </Input>

        <div className="rebanho-filters-clear-wrap">
          {filtrosAtivos ? <span className="rebanho-filters-active-dot" title="Há filtros ativos" aria-hidden="true" /> : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<X size={14} />}
            onClick={onClear}
            disabled={!filtrosAtivos}
          >
            Limpar filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
