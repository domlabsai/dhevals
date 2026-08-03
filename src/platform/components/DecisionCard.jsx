import { Link } from '../router.jsx'
import { Icon } from './icons.jsx'

/*
 * DecisionCard — a decision the platform can (or cannot yet) support.
 * available=false renders the honest variant: "Not yet available — release
 * gate closed" plus the reason and a link to the evidence/methodology.
 */
export function DecisionCard({
  title,
  conclusion,
  qualification,
  to,
  linkLabel = 'See the evidence',
  available = false,
  ...rest
}) {
  return (
    <article className={`decision${available ? '' : ' decision--unavailable'}`} data-testid="decision-card" {...rest}>
      <p className="eyebrow">{title}</p>
      {available ? (
        <p className="decision__conclusion heading-md">{conclusion}</p>
      ) : (
        <p className="decision__conclusion heading-md">
          <Icon name="lock" size={16} /> Not yet available
        </p>
      )}
      <p className="decision__qualification muted">
        {available ? qualification : `${qualification ?? 'The release gate is closed.'} Scores stay locked until calibration, verification, and human review complete.`}
      </p>
      {to ? (
        <Link to={to} className="decision__link">
          {linkLabel} →
        </Link>
      ) : null}
    </article>
  )
}

export default DecisionCard
