import { useId } from 'react';

export default function Input({
  label,
  error,
  hint,
  icon,
  prefix,
  suffix,
  className = '',
  type = 'text',
  inputMode,
  as = 'input',
  rows = 4,
  children = null,
  id,
  'aria-describedby': ariaDescribedByProp,
  ...props
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [ariaDescribedByProp, error ? errorId : (hint ? hintId : null)]
    .filter(Boolean)
    .join(' ') || undefined;

  const inputModeFinal = inputMode || (type === 'number' ? 'numeric' : undefined);
  const fieldClassName = `ui-input ${as === 'select' || as === 'textarea' ? 'ui-input--boxed' : ''}`.trim();

  const fieldProps = {
    id: fieldId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    ...props,
  };

  return (
    <div className={`ui-input-wrap ${className}`.trim()}>
      {label ? <label className="ui-input-label" htmlFor={fieldId}>{label}</label> : null}
      {as === 'select' ? (
        <select className={fieldClassName} {...fieldProps}>
          {children}
        </select>
      ) : as === 'textarea' ? (
        <textarea className={fieldClassName} rows={rows} {...fieldProps} />
      ) : (
        <div className={`ui-input-shell ${error ? 'error' : ''}`}>
          {icon ? <span className="ui-input-icon">{icon}</span> : null}
          {prefix ? <span className="ui-input-affix">{prefix}</span> : null}
          <input className="ui-input" type={type} inputMode={inputModeFinal} {...fieldProps} />
          {suffix ? <span className="ui-input-affix">{suffix}</span> : null}
        </div>
      )}
      {!error && hint ? <span className="ui-input-hint" id={hintId}>{hint}</span> : null}
      {error ? <span className="ui-input-error" id={errorId} role="alert">{error}</span> : null}
    </div>
  );
}
