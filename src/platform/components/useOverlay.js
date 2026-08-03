import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/*
 * Shared overlay behavior: focus trap inside the container, Escape closes,
 * focus is restored to the previously focused element on unmount, and body
 * scroll is locked while open.
 */
export function useOverlayBehavior(ref, { onClose }) {
  const restoreRef = useRef(null)

  useEffect(() => {
    restoreRef.current = document.activeElement
    const container = ref.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first focusable element (or the container itself).
    const focusTarget = container?.querySelector('[data-autofocus]') ?? container?.querySelector(FOCUSABLE) ?? container
    focusTarget?.focus?.()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }
      if (event.key !== 'Tab' || !container) return
      const focusables = Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (focusables.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [ref, onClose])
}
