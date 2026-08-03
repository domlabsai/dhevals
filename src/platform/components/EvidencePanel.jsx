import { Icon } from './icons.jsx'
import { formatMs, formatTokens } from '../data.js'

/*
 * EvidencePanel — the task-level evidence: prompt context, response excerpt
 * (mono, wraps fully — pt-BR text never truncates mid-word), deterministic
 * checks with pass/fail icon + text, and optional sources.
 */
export function EvidencePanel({ task, sources = [], className = '', ...rest }) {
  if (!task) return null
  return (
    <div className={`evidence stack${className ? ` ${className}` : ''}`} data-testid="evidence-panel" {...rest}>
      <section className="stack stack--2">
        <p className="eyebrow">Suite task prompt (public)</p>
        <div className="evidence__block" lang="pt-BR">{task.prompt ?? '—'}</div>
      </section>

      <section className="stack stack--2">
        <p className="eyebrow">Model response</p>
        <div className="evidence__block" lang="pt-BR">{task.output ?? '—'}</div>
      </section>

      <section className="stack stack--2">
        <p className="eyebrow">Deterministic checks ({task.checks?.length ?? 0})</p>
        <ul className="evidence__checks">
          {(task.checks ?? []).map((check) => (
            <li className="evidence__check" key={check.id}>
              <span className={`evidence__check-icon evidence__check-icon--${check.passed ? 'pass' : 'fail'}`}>
                <Icon name={check.passed ? 'check' : 'x'} size={12} />
              </span>
              <span className="mono micro evidence__check-id">{check.id}</span>
              <span className="badge">{check.type}</span>
              <span className="micro muted">{check.details ?? (check.passed ? 'passed' : 'failed')}</span>
              <span className="mono micro faint">score {typeof check.score === 'number' ? check.score : '—'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="row" aria-label="Task measurements">
        <span className="badge">Latency {formatMs(task.latency_ms)}</span>
        <span className="badge">Tokens {formatTokens(task.tokens)}</span>
        <span className="badge">
          Failure reason {task.failure_reason ?? '—'}
        </span>
      </section>

      {sources.length > 0 ? (
        <section className="stack stack--2">
          <p className="eyebrow">Sources</p>
          <ul className="stack stack--2">
            {sources.map((source) => (
              <li key={source}>
                <code className="mono micro">{source}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

export default EvidencePanel
