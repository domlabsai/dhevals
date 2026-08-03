import { useRef } from 'react'
import { IconButton } from './IconButton.jsx'
import { useOverlayBehavior } from './useOverlay.js'

/*
 * Drawer — right-side sheet. role=dialog aria-modal, focus trap, Escape and
 * overlay click close, focus restores to the trigger. 220ms via tokens.
 */
export function Drawer({ open, ...props }) {
  // Mount the panel only while open so useOverlayBehavior captures the
  // trigger fresh on every open and restores focus to it on close.
  if (!open) return null
  return <DrawerPanel {...props} />
}

function DrawerPanel({ onClose, title, labelledBy, children, className = '', ...rest }) {
  const ref = useRef(null)
  useOverlayBehavior(ref, { onClose })
  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={`drawer${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-testid="drawer"
        {...rest}
      >
        <div className="drawer__head">
          <div className="heading-md" id={labelledBy}>
            {title}
          </div>
          <IconButton icon="x" label="Close panel" onClick={onClose} data-autofocus />
        </div>
        <div className="drawer__body">{children}</div>
      </div>
    </>
  )
}

export default Drawer
