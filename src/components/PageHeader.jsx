export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="ph page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="ph-actions page-actions">{actions}</div> : null}
    </header>
  );
}
