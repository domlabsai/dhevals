import { useEffect, useState } from 'react'
import { Link, useLocation } from '../router.jsx'
import { Drawer } from './Drawer.jsx'
import { GlobalSearch } from './GlobalSearch.jsx'
import { Icon } from './icons.jsx'
import { IconButton } from './IconButton.jsx'

export const NAV_LINKS = [
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/compare', label: 'Compare' },
  { to: '/benchmarks', label: 'Benchmarks' },
  { to: '/reports', label: 'Reports' },
  { to: '/methodology', label: 'Methodology' },
]

function isActive(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`)
}

/*
 * TopNav — sticky 64px header. Desktop shows inline links + ⌘K search;
 * mobile collapses to a hamburger that opens a full-height nav sheet.
 */
export function TopNav() {
  const { pathname } = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // ⌘K / Ctrl+K opens search from anywhere.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close the nav sheet whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <>
      <header className="topnav" data-testid="top-nav">
        <div className="container topnav__inner">
          <Link to="/" className="topnav__brand" aria-label="DHEvals home">
            <img src="/brand/dhevals-lockup.svg" alt="DHEvals" height={24} />
          </Link>
          <nav className="topnav__links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="topnav__link"
                aria-current={isActive(pathname, link.to) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="topnav__actions">
            <button
              type="button"
              className="topnav__search"
              onClick={() => setSearchOpen(true)}
              aria-keyshortcuts="meta+k ctrl+k"
            >
              <Icon name="search" size={14} />
              Search
              <kbd>⌘K</kbd>
            </button>
            <Link to="/data" className="topnav__link" aria-current={isActive(pathname, '/data') ? 'page' : undefined}>
              Data
            </Link>
            <IconButton
              icon="menu"
              label="Open navigation menu"
              className="topnav__menu-btn"
              onClick={() => setMenuOpen(true)}
            />
          </div>
        </div>
      </header>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <nav aria-label="Mobile" className="nav-sheet__links">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="nav-sheet__link"
              aria-current={isActive(pathname, link.to) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
          <Link to="/data" className="nav-sheet__link" aria-current={isActive(pathname, '/data') ? 'page' : undefined}>
            Data
          </Link>
        </nav>
      </Drawer>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}

export default TopNav
