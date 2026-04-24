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
  ...props
}) {
  const inputModeFinal = inputMode || (type === 'number' ? 'numeric' : undefined);
  const fieldClassName = `ui-input ${as === 'select' || as === 'textarea' ? 'ui-input--boxed' : ''}`.trim();

  return (
    <div className={`ui-input-wrap ${className}`.trim()}>
      {label ? <label className="ui-input-label">{label}</label> : null}
      {as === 'select' ? (
        <select className={fieldClassName} {...props}>
          {children}
        </select>
      ) : as === 'textarea' ? (
        <textarea className={fieldClassName} rows={rows} {...props} />
      ) : (
        <div className={`ui-input-shell ${error ? 'error' : ''}`}>
          {icon ? <span className="ui-input-icon">{icon}</span> : null}
          {prefix ? <span className="ui-input-affix">{prefix}</span> : null}
          <input className="ui-input" type={type} inputMode={inputModeFinal} {...props} />
          {suffix ? <span className="ui-input-affix">{suffix}</span> : null}
        </div>
      )}
      {!error && hint ? <span className="ui-input-hint">{hint}</span> : null}
      {error ? <span className="ui-input-error">{error}</span> : null}
    </div>
  );
}
