import { useId } from 'react';

export default function Switch({
  label,
  checked = false,
  disabled = false,
  onChange,
  className = '',
  id,
  ...props
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <label htmlFor={fieldId} className={`ui-switch ${disabled ? 'ui-switch--disabled' : ''} ${className}`.trim()}>
      <span className="ui-switch-control">
        <input
          id={fieldId}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          {...props}
        />
        <span className="ui-switch-track" aria-hidden="true">
          <span className="ui-switch-thumb" />
        </span>
      </span>
      {label ? <span className="ui-switch-label">{label}</span> : null}
    </label>
  );
}
