import { useSeo } from '../seo.js'
import { EmptyState } from '../components/EmptyState.jsx'
import { Button } from '../components/Button.jsx'
import { Link } from '../router.jsx'

export function NotFoundPage() {
  useSeo({
    title: 'Page not found',
    description: 'This route does not exist on DHEvals.',
    path: '/404',
    noindex: true,
  })

  return (
    <div className="container section stack stack--6" data-testid="not-found-page">
      <EmptyState
        title="404 — this page is not part of the projection."
        body="The route you opened does not exist. Every public page on DHEvals is derived from the evidence store; this one has no artifact behind it."
        action={<Button to="/">Back to the homepage</Button>}
      />
      <nav className="category-strip" aria-label="Popular pages">
        <Link to="/leaderboard">Leaderboard</Link>
        <Link to="/benchmarks">Benchmarks</Link>
        <Link to="/reports">Reports</Link>
        <Link to="/methodology">Methodology</Link>
        <Link to="/data">Data</Link>
      </nav>
    </div>
  )
}

export default NotFoundPage
