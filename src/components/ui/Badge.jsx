const map = {
  success: ['var(--color-success)', 'var(--color-success-bg)'],
  warning: ['var(--color-warning)', 'var(--color-warning-bg)'],
  danger: ['var(--color-danger)', 'var(--color-danger-bg)'],
  info: ['var(--color-info)', 'var(--color-info-bg)'],
  neutral: ['var(--color-text-secondary)', 'var(--color-surface-2)'],
};

export default function Badge({ variant = 'neutral', children }) {
  const [color, bg] = map[variant] || map.neutral;

  return (
    <span className="ui-badge" style={{ color, background: bg }}>
      <span className="ui-badge-dot" style={{ background: color }} />
      {children}
    </span>
  );
}
