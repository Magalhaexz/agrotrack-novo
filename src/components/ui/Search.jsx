import { Search as SearchIcon, X, Loader2 } from 'lucide-react';
import Input from './Input';

export default function Search({
  value,
  onChange,
  onClear,
  loading = false,
  placeholder = 'Buscar...',
  className = '',
  ...props
}) {
  return (
    <div className={`ui-search ${className}`.trim()}>
      <Input
        type="search"
        icon={<SearchIcon size={16} />}
        suffix={
          loading ? (
            <Loader2 size={14} className="ui-spin" aria-hidden="true" />
          ) : value ? (
            <button
              type="button"
              className="ui-search-clear"
              onClick={onClear}
              aria-label="Limpar busca"
            >
              <X size={14} />
            </button>
          ) : null
        }
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={props['aria-label'] || placeholder}
        {...props}
      />
    </div>
  );
}
