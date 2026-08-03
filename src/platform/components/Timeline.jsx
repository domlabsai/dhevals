import { Link } from '../router.jsx'
import { StatusDot } from './StatusDot.jsx'
import { formatDate } from '../data.js'

/*
 * Timeline — vertical run/release history.
 * items: [{ date, color, label, title, meta, to? }]
 */
export function Timeline({ items = [], ariaLabel = 'History', className = '', ...rest }) {
  return (
    <ol className={`timeline${className ? ` ${className}` : ''}`} aria-label={ariaLabel} data-testid="timeline" {...rest}>
      {items.map((item, index) => (
        <li className="timeline__item" key={`${item.title}-${index}`}>
          <time className="timeline__date mono micro" dateTime={item.date ?? undefined}>
            {formatDate(item.date)}
          </time>
          <div className="timeline__body">
            <StatusDot color={item.color ?? 'cyan'} label={item.label} />
            <p className="timeline__title">
              {item.to ? <Link to={item.to}>{item.title}</Link> : item.title}
            </p>
            {item.meta ? <p className="timeline__meta micro faint">{item.meta}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default Timeline
