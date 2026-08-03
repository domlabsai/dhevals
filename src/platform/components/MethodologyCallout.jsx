import { Link } from '../router.jsx'

/*
 * MethodologyCallout — plain-language explainer band that routes readers to
 * /methodology before they over-read a number.
 */
export function MethodologyCallout({ children, className = '', ...rest }) {
  return (
    <aside className={`method-callout${className ? ` ${className}` : ''}`} data-testid="methodology-callout" {...rest}>
      <p className="eyebrow">How to read this</p>
      <p className="method-callout__text">
        {children ??
          'Every DHEvals number is scope-bound: a suite version, a date, a coverage figure, and an evidence state travel with it. A missing value is “—”, never zero — and nothing is ranked until the release gate passes.'}
      </p>
      <Link to="/methodology" className="method-callout__link">
        Read the methodology →
      </Link>
    </aside>
  )
}

export default MethodologyCallout
