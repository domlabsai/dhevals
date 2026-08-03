import { useEffect } from 'react'
import { Router, useLocation, matchPath } from './router.jsx'
import { PublicShell } from './components/PublicShell.jsx'
import { ToastProvider } from './components/Toast.jsx'
import './platform.css'

import { HomePage } from './pages/HomePage.jsx'
import { LeaderboardPage } from './pages/LeaderboardPage.jsx'
import { ModelPage } from './pages/ModelPage.jsx'
import { ComparePage } from './pages/ComparePage.jsx'
import { BenchmarksPage } from './pages/BenchmarksPage.jsx'
import { SuitePage } from './pages/SuitePage.jsx'
import { ReportsPage } from './pages/ReportsPage.jsx'
import { ReportPage } from './pages/ReportPage.jsx'
import { MethodologyPage } from './pages/MethodologyPage.jsx'
import { AboutPage } from './pages/AboutPage.jsx'
import { DataPage } from './pages/DataPage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'

const ROUTES = [
  { pattern: '/', render: () => <HomePage /> },
  { pattern: '/leaderboard', render: () => <LeaderboardPage /> },
  { pattern: '/models/:slug', render: (p) => <ModelPage slug={p.slug} /> },
  { pattern: '/compare', render: () => <ComparePage /> },
  { pattern: '/compare/:pair', render: (p) => <ComparePage pair={p.pair} /> },
  { pattern: '/benchmarks', render: () => <BenchmarksPage /> },
  { pattern: '/benchmarks/:suiteSlug', render: (p) => <SuitePage suiteSlug={p.suiteSlug} /> },
  { pattern: '/reports', render: () => <ReportsPage /> },
  { pattern: '/reports/:runId', render: (p) => <ReportPage runId={p.runId} /> },
  { pattern: '/methodology', render: () => <MethodologyPage /> },
  { pattern: '/about', render: () => <AboutPage /> },
  { pattern: '/data', render: () => <DataPage /> },
]

function resolveRoute(pathname) {
  for (const route of ROUTES) {
    const params = matchPath(route.pattern, pathname)
    if (params) return route.render(params)
  }
  return <NotFoundPage />
}

function RoutedApp() {
  const { pathname } = useLocation()

  // Route changes always start from the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return <PublicShell>{resolveRoute(pathname)}</PublicShell>
}

export default function PlatformApp() {
  return (
    <Router>
      <ToastProvider>
        <RoutedApp />
      </ToastProvider>
    </Router>
  )
}
