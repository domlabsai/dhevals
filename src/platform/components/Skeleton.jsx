/*
 * Skeleton — shimmer placeholder while projection data loads.
 * variant="line" for text lines, "block" for panels; shimmer is disabled
 * under prefers-reduced-motion by platform.css.
 */
export function Skeleton({ variant = 'line', width, height, lines = 1, className = '', ...rest }) {
  if (variant === 'block') {
    return (
      <div
        className={`skeleton skeleton--block${className ? ` ${className}` : ''}`}
        style={{ width, height }}
        aria-hidden="true"
        {...rest}
      />
    )
  }
  return (
    <div aria-hidden="true" className={className} {...rest}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="skeleton skeleton--line"
          style={{ width: width ?? (i === lines - 1 && lines > 1 ? '60%' : '100%'), height }}
        />
      ))}
    </div>
  )
}

export default Skeleton
