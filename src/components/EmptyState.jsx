export default function EmptyState({ title, subtitle }) {
  return (
    <div className="empty">
      <div className="empty-circle" aria-hidden="true">—</div>
      <p className="empty-title">{title}</p>
      <span className="empty-subtitle">{subtitle}</span>
    </div>
  );
}