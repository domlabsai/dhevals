import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

/*
 * Minimal history-API router. No dependencies — the public platform only
 * needs pathname routing with :param matching, links, and query access.
 */

const RouterContext = createContext(null)

function readLocation() {
  return { pathname: window.location.pathname, search: window.location.search }
}

export function navigate(path, { replace = false } = {}) {
  if (replace) {
    window.history.replaceState({}, '', path)
  } else {
    window.history.pushState({}, '', path)
  }
  // pushState/replaceState don't emit popstate; notify the router ourselves.
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function Router({ children }) {
  // Track pathname AND search so query-only navigations re-render subscribers.
  const [location, setLocation] = useState(readLocation)

  useEffect(() => {
    const onPop = () => setLocation(readLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return <RouterContext.Provider value={location}>{children}</RouterContext.Provider>
}

export function useLocation() {
  const location = useContext(RouterContext)
  if (location === null) throw new Error('useLocation must be used inside <Router>')
  return location
}

export function useQuery() {
  const { search } = useLocation()
  return new URLSearchParams(search)
}

export function useNavigate() {
  return useCallback((path, options) => navigate(path, options), [])
}

export function Link({
  to,
  replace = false,
  className,
  children,
  onClick,
  ...rest
}) {
  const handleClick = (event) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    // Let the browser handle new-tab / download modifier clicks.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.button !== 0) return
    event.preventDefault()
    navigate(to, { replace })
    window.scrollTo(0, 0)
  }
  return (
    <a href={to} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}

/*
 * matchPath('/models/:slug', '/models/example-model')
 *   -> { slug: 'example-model' } or null
 */
export function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return null
  const params = {}
  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i]
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(pathParts[i])
    } else if (part !== pathParts[i]) {
      return null
    }
  }
  return params
}
