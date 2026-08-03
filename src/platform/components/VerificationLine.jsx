import { formatDate } from '../data.js'

/*
 * VerificationLine — mono micro provenance line. Nulls render as "—".
 * e.g. "Suite v0.2.0 · rev a4886de · verified Aug 3, 2026"
 */
export function VerificationLine({ suiteVersion, revision, verifiedAt, className = '', ...rest }) {
  const parts = [
    `Suite v${suiteVersion ?? '—'}`,
    `rev ${revision ?? '—'}`,
    `verified ${verifiedAt ? formatDate(verifiedAt) : '—'}`,
  ]
  return (
    <p className={`verification-line${className ? ` ${className}` : ''}`} data-testid="verification-line" {...rest}>
      {parts.join(' · ')}
    </p>
  )
}

export default VerificationLine
