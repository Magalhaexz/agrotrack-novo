export default function EmptyState({ title, subtitle }) {
  return (
    <div className="empty">
      <div className="empty-circle">—</div>
      <p>{title}</p>
      <span>{subtitle}</span>
    </div>
  );
}
