import { Icon } from './icons.jsx'

/*
 * SourceList — provenance/source links. Absolute URLs render as external
 * links (icon + rel noopener); plain repo paths render as mono text so
 * private-implementation locations are never turned into fake links.
 */
export function SourceList({ sources = [], label = 'Sources', className = '', ...rest }) {
  if (!sources.length) {
    return (
      <p className={`micro faint${className ? ` ${className}` : ''}`} data-testid="source-list" {...rest}>
        {label}: —
      </p>
    )
  }
  return (
    <ul className={`sourcelist${className ? ` ${className}` : ''}`} aria-label={label} data-testid="source-list" {...rest}>
      {sources.map((source) => {
        const isUrl = /^https?:\/\//.test(source)
        return (
          <li key={source} className="sourcelist__item">
            {isUrl ? (
              <a href={source} target="_blank" rel="noopener noreferrer" className="sourcelist__link">
                <Icon name="external" size={12} />
                <span className="mono micro">{source}</span>
              </a>
            ) : (
              <code className="mono micro sourcelist__path" title="Repository path (source of this evidence)">
                {source}
              </code>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default SourceList
