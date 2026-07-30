const variants = ['neutral', 'primary', 'danger'];
const sizes = ['md', 'lg'];

export default function IconButton({
  icon,
  label,
  variant = 'neutral',
  size = 'md',
  disabled = false,
  className = '',
  ...props
}) {
  const safeVariant = variants.includes(variant) ? variant : 'neutral';
  const safeSize = sizes.includes(size) ? size : 'md';

  return (
    <button
      type="button"
      className={`ui-icon-button ui-icon-button--${safeVariant} ui-icon-button--${safeSize} ${className}`.trim()}
      disabled={disabled}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </button>
  );
}
