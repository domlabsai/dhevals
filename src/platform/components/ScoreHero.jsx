import { formatScore, formatDate } from '../data.js'
import { EvidenceBadge } from './EvidenceBadge.jsx'

/*
 * ScoreHero — the big 0–100 score with its evidence context. When the score
 * is null the hero renders a large honest "—" plus the evidence state and a
 * one-line explanation; never a zero.
 */
export function ScoreHero({
  score,
  evidenceStatus,
  suiteName,
  suiteVersion,
  date,
  size = 'lg',
  nullExplanation = 'Not evaluated in this scope yet.',
  className = '',
  ...rest
}) {
  const hasScore = typeof score === 'number' && !Number.isNaN(score)
  return (
    <div className={`score-hero${className ? ` ${className}` : ''}`} data-testid="score-hero" {...rest}>
      <div className="score-hero__value">
        <span className={size === 'xl' ? 'display-xl' : 'display-lg'}>
          {hasScore ? formatScore(score) : '—'}
        </span>
        <span className="score-hero__scale">/100</span>
      </div>
      {evidenceStatus ? <EvidenceBadge state={evidenceStatus} size="md" /> : null}
      {!hasScore ? <p className="muted">{nullExplanation}</p> : null}
      {suiteName || suiteVersion || date ? (
        <p className="score-hero__scope">
          {[suiteName, suiteVersion ? `v${suiteVersion}` : null, date ? formatDate(date) : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  )
}

export default ScoreHero
