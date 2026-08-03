import { formatDate } from '../data.js'

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

function relativeTime(iso) {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null
  const diff = Date.now() - then
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return `${months}mo ago`
}

/*
 * FreshnessLabel — relative time with the absolute date on hover/AT.
 * Older than 7 days gets amber "stale" styling (still with text).
 */
export function FreshnessLabel({ at, prefix = 'Verified', className = '', ...rest }) {
  if (!at) {
    return (
      <span className={`freshness${className ? ` ${className}` : ''}`} data-testid="freshness-label" {...rest}>
        {prefix} —
      </span>
    )
  }
  const relative = relativeTime(at)
  const stale = Date.now() - Date.parse(at) > STALE_AFTER_MS
  const absolute = formatDate(at)
  return (
    <span
      className={`freshness${stale ? ' freshness--stale' : ''}${className ? ` ${className}` : ''}`}
      data-testid="freshness-label"
      data-stale={stale || undefined}
      title={absolute}
      aria-label={`${prefix} ${absolute} (${relative})`}
      {...rest}
    >
      {prefix} {relative ?? '—'}
    </span>
  )
}

export default FreshnessLabel
