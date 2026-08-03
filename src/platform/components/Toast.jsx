import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Icon } from './icons.jsx'

/*
 * Toast — bottom-right stack, aria-live polite, auto-dismiss after 4s.
 * Usage: wrap the app in <ToastProvider>, then `const toast = useToast()`.
 */
const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message) => {
      toastId += 1
      const id = toastId
      setToasts((current) => [...current, { id, message }])
      timers.current.set(id, setTimeout(() => dismiss(id), 4000))
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite" data-testid="toast-stack">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id} data-testid="toast">
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="toast__close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast must be used inside <ToastProvider>')
  return push
}
