/*
 * StatusDot — 8px dot ALWAYS paired with a visible text label.
 */
export function StatusDot({ color = 'cyan', label, className = '', ...rest }) {
  return (
    <span className={`status-dot status-dot--${color}${className ? ` ${className}` : ''}`} data-testid="status-dot" {...rest}>
      <span className="status-dot__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export default StatusDot
