import { Drawer } from './Drawer.jsx'
import { EvidencePanel } from './EvidencePanel.jsx'
import { IconButton } from './IconButton.jsx'
import { useMediaQuery } from './useMediaQuery.js'
import { formatMs, formatTokens } from '../data.js'

/*
 * RunInspector — detail panel for one selected task. Desktop renders an
 * inline expandable section under the table; mobile renders a Drawer.
 * Content: full evidence, checks, latency, tokens, failure reason.
 */
export function RunInspector({ task, open, onClose, className = '', ...rest }) {
  const isMobile = useMediaQuery('(max-width: 767px)')

  const content = task ? (
    <div className="stack">
      <header className="stack stack--2">
        <p className="eyebrow">Task evidence</p>
        <p className="heading-md">{task.title}</p>
        <div className="row">
          <span className="badge">{task.category}</span>
          <span className={`badge ${task.status === 'pass' ? 'badge--lime' : 'badge--amber'}`}>
            {task.status}
          </span>
          <span className="badge">Score {typeof task.score === 'number' ? `${Math.round(task.score * 100)}%` : '—'}</span>
          <span className="badge">Latency {formatMs(task.latency_ms)}</span>
          <span className="badge">Tokens {formatTokens(task.tokens)}</span>
        </div>
      </header>
      <EvidencePanel task={task} />
    </div>
  ) : null

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title={task?.title ?? 'Task evidence'}
        data-testid="run-inspector"
        {...rest}
      >
        {content}
      </Drawer>
    )
  }

  if (!open || !task) return null
  return (
    <section
      className={`run-inspector${className ? ` ${className}` : ''}`}
      aria-label={`Evidence for task ${task.title}`}
      data-testid="run-inspector"
      {...rest}
    >
      <div className="run-inspector__head">
        <span className="micro faint mono">{task.task_id}</span>
        <IconButton icon="x" label="Close task evidence" onClick={onClose} compact />
      </div>
      {content}
    </section>
  )
}

export default RunInspector
