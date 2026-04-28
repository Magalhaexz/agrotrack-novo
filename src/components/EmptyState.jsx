import { FileSearch } from 'lucide-react';

export default function EmptyState({
  title,
  subtitle,
  icon = null,
  compact = false,
  tone = 'neutral',
  align = 'center',
  action = null,
}) {
  const IconComponent = icon || FileSearch;
  return (
    <div className={`empty-state empty-state--${tone} empty-state--${align} ${compact ? 'empty-state--compact' : ''}`.trim()}>
      <div className="empty-state-icon" aria-hidden="true">
        <IconComponent size={compact ? 18 : 24} />
      </div>
      <p className="empty-state-title">{title}</p>
      {subtitle ? <span className="empty-state-description">{subtitle}</span> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
