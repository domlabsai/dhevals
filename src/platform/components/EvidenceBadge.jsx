import { EVIDENCE_STATES } from '../data.js'
import { Icon } from './icons.jsx'

const STATE_ICONS = {
  supported: 'check',
  estimated: 'tilde',
  pending: 'clock',
  locked: 'lock',
  invalid: 'x',
}

/*
 * EvidenceBadge — icon + text label + token color. The label is always
 * rendered: status is never communicated by color alone.
 */
export function EvidenceBadge({ state, size = 'sm', className = '', ...rest }) {
  const meta = EVIDENCE_STATES[state] ?? {
    label: state ?? 'Unknown',
    color: 'cyan',
    description: '',
  }
  return (
    <span
      className={`badge badge--${meta.color}${size === 'md' ? ' badge--md' : ''}${className ? ` ${className}` : ''}`}
      data-testid="evidence-badge"
      data-state={state}
      title={meta.description || undefined}
      {...rest}
    >
      <Icon name={STATE_ICONS[state] ?? 'alert-triangle'} />
      {meta.label}
    </span>
  )
}

export default EvidenceBadge
