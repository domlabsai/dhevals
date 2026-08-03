import { useRef } from 'react'
import { IconButton } from './IconButton.jsx'
import { useOverlayBehavior } from './useOverlay.js'

/*
 * Dialog — centered modal with the same focus behavior as Drawer.
 * Clicking the backdrop closes.
 */
export function Dialog({ open, ...props }) {
  // Mount the panel only while open so useOverlayBehavior captures the
  // trigger fresh on every open and restores focus to it on close.
  if (!open) return null
  return <DialogPanel {...props} />
}

function DialogPanel({ onClose, title, children, className = '', ...rest }) {
  const ref = useRef(null)
  useOverlayBehavior(ref, { onClose })
  return (
    <div className="dialog" onClick={onClose}>
      <div
        ref={ref}
        className={`dialog__panel${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        data-testid="dialog"
        onClick={(event) => event.stopPropagation()}
        {...rest}
      >
        {title ? (
          <div className="dialog__head">
            <div className="heading-md">{title}</div>
            <IconButton icon="x" label="Close dialog" onClick={onClose} />
          </div>
        ) : null}
        <div className="dialog__body">{children}</div>
      </div>
    </div>
  )
}

export default Dialog
