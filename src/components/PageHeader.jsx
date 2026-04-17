export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="ph">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
