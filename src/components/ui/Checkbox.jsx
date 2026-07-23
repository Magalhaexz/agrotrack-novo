import { useId } from 'react';
import { Check, Minus } from 'lucide-react';

export default function Checkbox({
  label,
  checked = false,
  indeterminate = false,
  disabled = false,
  onChange,
  className = '',
  id,
  ...props
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <label htmlFor={fieldId} className={`ui-checkbox ${disabled ? 'ui-checkbox--disabled' : ''} ${className}`.trim()}>
      <span className="ui-checkbox-control">
        <input
          id={fieldId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          ref={(el) => {
            if (el) el.indeterminate = indeterminate;
          }}
          {...props}
        />
        <span className="ui-checkbox-box" aria-hidden="true">
          {indeterminate ? <Minus size={12} /> : checked ? <Check size={12} /> : null}
        </span>
      </span>
      {label ? <span className="ui-checkbox-label">{label}</span> : null}
    </label>
  );
}
