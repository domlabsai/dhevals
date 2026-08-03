import { Link } from '../router.jsx'
import { Icon } from './icons.jsx'

/*
 * Breadcrumbs — items: [{ label, to? }]. The last item (or any without `to`)
 * is the current page.
 */
export function Breadcrumbs({ items = [], className = '', ...rest }) {
  return (
    <nav aria-label="Breadcrumb" className={`breadcrumbs${className ? ` ${className}` : ''}`} data-testid="breadcrumbs" {...rest}>
      <ol>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1 || !item.to
          return (
            <li key={`${item.label}-${index}`} className="row" style={{ gap: 'var(--space-2)' }}>
              {index > 0 ? (
                <span className="breadcrumbs__sep" aria-hidden="true">
                  <Icon name="chevron-right" size={12} />
                </span>
              ) : null}
              {isCurrent ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <Link to={item.to}>{item.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumbs
