/*
 * Metric — label + mono tabular value + optional unit/note.
 * Null values render "—" with a "Not measured" explanation on hover.
 */
export function Metric({ label, value, unit, note, className = '', ...rest }) {
  const missing = value === null || value === undefined || value === ''
  return (
    <div className={`metric${className ? ` ${className}` : ''}`} data-testid="metric" {...rest}>
      <span className="metric__label">{label}</span>
      <span className="metric__value" title={missing ? 'Not measured' : undefined}>
        {missing ? '—' : value}
        {!missing && unit ? <span className="metric__unit">{unit}</span> : null}
      </span>
      {note ? <span className="metric__note">{note}</span> : null}
    </div>
  )
}

export default Metric
