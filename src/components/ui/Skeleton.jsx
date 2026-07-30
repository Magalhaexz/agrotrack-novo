const variants = ['text', 'title', 'kpi', 'card', 'row', 'circle'];

export default function Skeleton({ variant = 'text', width, height, count = 1, className = '' }) {
  const safeVariant = variants.includes(variant) ? variant : 'text';
  const style = { width, height };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          className={`ui-skeleton ui-skeleton--${safeVariant} ${className}`.trim()}
          style={style}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
