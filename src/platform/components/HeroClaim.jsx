import { Button } from './Button.jsx'

/*
 * HeroClaim — the homepage claim block: eyebrow, balanced display headline,
 * one supporting sentence, CTA row, and a provenance evidence line.
 */
export function HeroClaim({ eyebrow, headline, support, primary, secondary, evidence, ...rest }) {
  return (
    <section className="hero" data-testid="hero-claim" {...rest}>
      <div className="hero__claim">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display-xl hero__headline">{headline}</h1>
        <p className="body-lg muted hero__support">{support}</p>
        <div className="hero__cta">
          {primary ? <Button to={primary.to}>{primary.label}</Button> : null}
          {secondary ? (
            <Button to={secondary.to} href={secondary.href} variant="secondary">
              {secondary.label}
            </Button>
          ) : null}
        </div>
        {evidence ? <div className="hero__evidence">{evidence}</div> : null}
      </div>
    </section>
  )
}

export default HeroClaim
