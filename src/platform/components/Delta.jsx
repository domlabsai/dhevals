/*
 * Delta — signed difference with glyph AND text (never color alone).
 * Null means the comparison is not meaningful and says so.
 */
export function Delta({ value, unit = '', against, className = '', ...rest }) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return (
      <span className="delta delta--flat" data-testid="delta" {...rest}>
        = — not comparable
      </span>
    )
  }
  const sign = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  const glyph = value > 0 ? '▲' : value < 0 ? '▼' : '='
  const formatted = `${value > 0 ? '+' : ''}${value.toFixed(1)}${unit}`
  return (
    <span className={`delta delta--${sign}${className ? ` ${className}` : ''}`} data-testid="delta" data-sign={sign} {...rest}>
      <span aria-hidden="true">{glyph}</span>
      <span>
        {formatted}
        {against ? ` vs ${against}` : ''}
      </span>
    </span>
  )
}

export default Delta
