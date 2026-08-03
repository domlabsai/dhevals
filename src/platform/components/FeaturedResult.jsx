import { Link } from '../router.jsx'
import { EvidenceBadge } from './EvidenceBadge.jsx'
import { FreshnessLabel } from './FreshnessLabel.jsx'
import { CoverageMeter } from './CoverageMeter.jsx'
import { formatScore, formatDate } from '../data.js'

/*
 * FeaturedResult — the latest-signal panel. Honest by construction: a null
 * score renders "—" with the explanation, and fixture/locked signals carry
 * their EvidenceBadge plus an explicit caveat.
 */
export function FeaturedResult({
  signal,
  revision,
  action,
  caveat,
  className = '',
  ...rest
}) {
  if (!signal) return null
  const hasScore = typeof signal.score === 'number' && !Number.isNaN(signal.score)
  return (
    <section className={`featured${className ? ` ${className}` : ''}`} aria-label="Latest signal" data-testid="featured-result" {...rest}>
      <div className="featured__head">
        <p className="eyebrow">Latest signal</p>
        <FreshnessLabel at={signal.date} prefix="Run" />
      </div>
      <div className="featured__body">
        <div className="featured__identity">
          <p className="heading-lg">{signal.model_name}</p>
          <p className="muted">
            {signal.suite_id} · v{signal.suite_version}
          </p>
          <div className="row">
            <EvidenceBadge state={signal.evidence_status} size="md" />
            {signal.is_fixture ? <span className="badge badge--amber">Fixture</span> : null}
          </div>
        </div>
        <div className="featured__score">
          <div className="score-hero__value">
            <span className="display-lg num">{hasScore ? formatScore(signal.score) : '—'}</span>
            <span className="score-hero__scale">/100</span>
          </div>
          <CoverageMeter coverage={signal.coverage} />
        </div>
      </div>
      {caveat ? <p className="featured__caveat micro muted">{caveat}</p> : null}
      <div className="featured__foot">
        {action ? (
          <Link to={action.to} className="featured__action">
            {action.label} →
          </Link>
        ) : null}
        <span className="verification-line">
          rev {revision ?? '—'} · {formatDate(signal.date)}
        </span>
      </div>
    </section>
  )
}

export default FeaturedResult
