import { Loader2 } from 'lucide-react';

const variants = ['primary', 'secondary', 'danger', 'ghost', 'outline'];

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon = null,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...props
}) {
  const safeVariant = variants.includes(variant) ? variant : 'primary';

  return (
    <button
      type="button"
      className={`ui-button ui-button--${safeVariant} ui-button--${size} ${fullWidth ? 'ui-button--full' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={16} className="ui-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}
