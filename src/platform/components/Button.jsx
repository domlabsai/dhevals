import { Link } from '../router.jsx'
import { Icon } from './icons.jsx'

/*
 * Button — primary (lime) / secondary (outline) / quiet / danger variants.
 * Renders as an internal <Link>, external <a>, or <button>.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  icon,
  className = '',
  children,
  ...rest
}) {
  const cls = `btn btn--${variant}${size === 'sm' ? ' btn--sm' : ''}${className ? ` ${className}` : ''}`
  const content = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" className={cls} {...rest}>
      {content}
    </button>
  )
}

export default Button
