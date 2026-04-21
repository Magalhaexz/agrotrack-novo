export default function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`ui-card ${className}`.trim()}>
      {(title || subtitle || action) && (
        <header className="ui-card-header">
          <div>
            {title ? <h3 className="ui-card-title">{title}</h3> : null}
            {subtitle ? <p className="ui-card-subtitle">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
