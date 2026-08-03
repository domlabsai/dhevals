import { useProjection } from '../data.js'
import { Link } from '../router.jsx'

const COLUMNS = [
  {
    heading: 'Platform',
    links: [
      { to: '/leaderboard', label: 'Leaderboard' },
      { to: '/compare', label: 'Compare' },
      { to: '/benchmarks', label: 'Benchmarks' },
      { to: '/reports', label: 'Reports' },
    ],
  },
  {
    heading: 'Trust',
    links: [
      { to: '/methodology', label: 'Methodology' },
      { to: '/data', label: 'Data' },
      { to: '/about', label: 'About' },
    ],
  },
  {
    heading: 'Links',
    links: [
      { href: 'https://github.com/domlabsai/dhevals', label: 'GitHub' },
      { href: '#', label: 'X' },
      { href: '#', label: 'LinkedIn' },
    ],
  },
]

/*
 * Footer — editorial columns plus a provenance bottom line. The source
 * revision comes from the public projection when it has loaded.
 */
export function Footer() {
  const { status, data } = useProjection()
  const revision = status === 'ready' ? data.overview?.source_revision : null

  return (
    <footer className="footer" data-testid="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <img src="/brand/dhevals-lockup.svg" alt="DHEvals" height={24} />
            <p className="footer__descriptor">AI model evaluation laboratory</p>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.heading} className="footer__col" aria-label={column.heading}>
              <p className="footer__heading">{column.heading}</p>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to}>{link.label}</Link>
                    ) : (
                      <a href={link.href} aria-label={link.href === '#' ? `${link.label} (coming soon)` : undefined} rel="noopener">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="footer__bottom">
          <span>© 2026 DHEvals{revision ? <span className="mono"> · rev {revision}</span> : null}</span>
          <span>Static public projection — no live inference</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
