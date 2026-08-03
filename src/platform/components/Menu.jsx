import { useEffect, useRef } from 'react'
import { Icon } from './icons.jsx'

/*
 * Menu — internal details/summary dropdown used by ExportMenu and ShareMenu.
 * Closes on outside click and Escape. The trigger looks like a Button.
 */
export function Menu({ label, icon = 'chevron-down', testid, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        ref.current.open = false
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false
        ref.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <details className="menu" ref={ref} data-testid={testid}>
      <summary className="btn btn--secondary">
        {icon ? <Icon name={icon} /> : null}
        {label}
      </summary>
      <div className="menu__pop">{children}</div>
    </details>
  )
}

export default Menu
