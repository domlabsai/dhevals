/*
 * CoverageMeter — thin lime bar + "86% · 9/10 tasks" text. Null → "—".
 */
export function CoverageMeter({ coverage, completed, total, unitLabel = 'tasks', className = '', ...rest }) {
  if (typeof coverage !== 'number' || Number.isNaN(coverage)) {
    return (
      <div className={`coverage-meter${className ? ` ${className}` : ''}`} data-testid="coverage-meter" {...rest}>
        <span className="coverage-meter__text">Coverage —</span>
      </div>
    )
  }
  const percent = Math.round(coverage * 100)
  const text =
    typeof completed === 'number' && typeof total === 'number'
      ? `${percent}% · ${completed}/${total} ${unitLabel}`
      : `${percent}% coverage`
  return (
    <div className={`coverage-meter${className ? ` ${className}` : ''}`} data-testid="coverage-meter" {...rest}>
      <div
        className="coverage-meter__track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Coverage ${text}`}
      >
        <div className="coverage-meter__fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="coverage-meter__text">{text}</span>
    </div>
  )
}

export default CoverageMeter
