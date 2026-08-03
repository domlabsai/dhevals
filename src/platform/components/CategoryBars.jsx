import { useId } from 'react'
import { formatScore } from '../data.js'

/*
 * CategoryBars — horizontal bars for category scores (0–100, zero baseline).
 * States: verified (lime fill), estimated (amber hatch + dashed outline),
 * missing (flat surface, "—" label). Exact value labels always render; a
 * visually-hidden data table mirrors the chart for assistive tech.
 *
 * items: [{ category, score: number|null, state: 'verified'|'estimated'|'missing', note? }]
 */
export function CategoryBars({ items = [], caption, scope, className = '', ...rest }) {
  const tableId = useId()
  return (
    <figure className={`catbars${className ? ` ${className}` : ''}`} data-testid="category-bars" {...rest}>
      <div className="catbars__rows">
        {items.map((item) => {
          const hasScore = typeof item.score === 'number' && !Number.isNaN(item.score)
          const state = hasScore ? item.state ?? 'verified' : 'missing'
          return (
            <div className={`catbars__row catbars__row--${state}`} key={item.category}>
              <span className="catbars__label label">{item.category}</span>
              <span
                className="catbars__track"
                role="img"
                aria-label={`${item.category}: ${hasScore ? `${formatScore(item.score)} out of 100` : 'not scored'}`}
              >
                {hasScore ? (
                  <span className={`catbars__fill catbars__fill--${state}`} style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }} />
                ) : null}
              </span>
              <span className="catbars__value mono">
                {hasScore ? formatScore(item.score) : '—'}
              </span>
            </div>
          )
        })}
      </div>
      <figcaption className="catbars__caption micro faint">
        {[scope, caption].filter(Boolean).join(' · ')}
      </figcaption>
      <table className="visually-hidden" id={tableId}>
        <caption>{caption ?? 'Category scores'}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Score (0–100)</th>
            <th scope="col">Evidence state</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.category}>
              <td>{item.category}</td>
              <td>{typeof item.score === 'number' ? formatScore(item.score) : '—'}</td>
              <td>{typeof item.score === 'number' ? item.state ?? 'verified' : 'missing'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export default CategoryBars
