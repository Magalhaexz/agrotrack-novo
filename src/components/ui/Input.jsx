export default function Input({ label, error, icon, prefix, suffix, className = '', type = 'text', inputMode, ...props }) {
  const inputModeFinal = inputMode || (type === 'number' ? 'numeric' : undefined);

  return (
    <div className={`ui-input-wrap ${className}`.trim()}>
      {label ? <label className="ui-input-label">{label}</label> : null}
      <div className={`ui-input-shell ${error ? 'error' : ''}`}>
        {icon ? <span className="ui-input-icon">{icon}</span> : null}
        {prefix ? <span className="ui-input-affix">{prefix}</span> : null}
        <input className="ui-input" type={type} inputMode={inputModeFinal} {...props} />
        {suffix ? <span className="ui-input-affix">{suffix}</span> : null}
      </div>
      {error ? <span className="ui-input-error">{error}</span> : null}
    </div>
  );
}
