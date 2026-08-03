import { Icon } from './icons.jsx'

/*
 * IconButton — 40px hit target (32px compact). An accessible label is
 * required; it doubles as the tooltip via title.
 */
export function IconButton({ icon, label, compact = false, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`icon-btn${compact ? ' icon-btn--compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  )
}

export default IconButton
