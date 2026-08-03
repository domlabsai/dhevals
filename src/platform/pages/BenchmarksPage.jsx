import { useProjection, formatDate } from '../data.js'
import { useSeo, datasetJsonLd } from '../seo.js'
import { Link, useNavigate } from '../router.jsx'
import { StatusDot } from '../components/StatusDot.jsx'
import { DataTable } from '../components/DataTable.jsx'
import { PageLoading, PageError, StaleBanner } from './pageStates.jsx'

const SUITE_STATUS = {
  fixture_only: { color: 'amber', label: 'Fixture only' },
  calibration_pending: { color: 'amber', label: 'Calibration pending' },
  calibrated: { color: 'lime', label: 'Calibrated' },
}

function truncateHash(hash) {
  if (!hash) return '—'
  return hash.length > 24 ? `${hash.slice(0, 24)}…` : hash
}

export function BenchmarksPage() {
  useSeo({
    title: 'Benchmark suites',
    description:
      'The versioned DHEvals task suites: Brazilian-Portuguese heavy-user tasks with hash-pinned manifests, calibration status, and full provenance.',
    path: '/benchmarks',
    jsonLd: datasetJsonLd({
      name: 'DHEvals benchmark suites',
      description: 'Versioned Brazilian-Portuguese heavy-user task suites with hash-pinned manifests.',
      path: '/benchmarks',
    }),
  })
  const { status, data, error, stale, generatedAt } = useProjection()
  const navigate = useNavigate()

  if (status === 'loading') return <PageLoading testid="benchmarks-page" />
  if (status === 'error') return <PageError testid="benchmarks-page" error={error} />

  return (
    <div className="container section stack stack--6" data-testid="benchmarks-page">
      {stale ? <StaleBanner generatedAt={generatedAt} /> : null}

      <header className="stack reading">
        <p className="eyebrow">Benchmarks</p>
        <h1 className="heading-xl">Task suites</h1>
        <p className="body-lg muted">
          Every score on DHEvals is bound to one of these suites — a versioned, hash-pinned manifest
          of Brazilian-Portuguese heavy-user tasks. Suites do not change silently: a new version is a
          new scope.
        </p>
      </header>

      <section aria-label="Suites">
        {data.suites.map((suite) => {
          const statusMeta = SUITE_STATUS[suite.status] ?? { color: 'cyan', label: suite.status }
          return (
            <article className="suite-row" key={suite.slug}>
              <div className="suite-row__main">
                <div className="row">
                  <h2 className="heading-lg">{suite.title}</h2>
                  <span className="badge badge--cobalt">v{suite.version}</span>
                  {suite.current_public ? <span className="badge badge--lime">Current public</span> : null}
                </div>
                <div className="row">
                  <StatusDot color={statusMeta.color} label={statusMeta.label} />
                  <span className="badge">{suite.language}</span>
                  <span className="badge">{suite.task_count} tasks</span>
                  <span className="badge">{suite.dimension_count} scoring dimensions</span>
                </div>
                <p className="muted" lang="pt-BR">{suite.description}</p>
                <div className="category-strip" aria-label="Categories">
                  {suite.categories.map((category) => (
                    <Link key={category} to={`/leaderboard?category=${encodeURIComponent(category)}`}>
                      {category}
                    </Link>
                  ))}
                </div>
                <Link to={`/benchmarks/${suite.slug}`} className="label">
                  Open suite detail →
                </Link>
              </div>
              <dl className="suite-row__meta">
                <div>
                  <dt className="metric__label">Manifest hash</dt>
                  <dd className="mono micro" title={suite.manifest_hash}>{truncateHash(suite.manifest_hash)}</dd>
                </div>
                <div>
                  <dt className="metric__label">Last reviewed</dt>
                  <dd>{formatDate(suite.last_reviewed_at)}</dd>
                </div>
                <div>
                  <dt className="metric__label">Calibration</dt>
                  <dd>
                    {suite.calibration.required_groups
                      ? `${suite.calibration.completed_groups}/${suite.calibration.required_groups} anchor groups`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="metric__label">License</dt>
                  <dd className="micro muted">{suite.license}</dd>
                </div>
              </dl>
            </article>
          )
        })}
      </section>

      <section className="stack" aria-label="Suites as a table">
        <p className="eyebrow">Table view</p>
        <DataTable
          caption="All DHEvals task suites with version, status, and calibration progress."
          columns={[
            { key: 'title', label: 'Suite' },
            { key: 'version', label: 'Version', render: (suite) => `v${suite.version}` },
            { key: 'language', label: 'Locale' },
            { key: 'task_count', label: 'Tasks', numeric: true },
            { key: 'dimension_count', label: 'Dimensions', numeric: true },
            {
              key: 'status',
              label: 'Status',
              render: (suite) => (SUITE_STATUS[suite.status] ?? { label: suite.status }).label,
            },
            {
              key: 'calibration',
              label: 'Calibration',
              numeric: true,
              render: (suite) =>
                suite.calibration.required_groups
                  ? `${suite.calibration.completed_groups}/${suite.calibration.required_groups}`
                  : null,
            },
            { key: 'last_reviewed_at', label: 'Last reviewed', render: (suite) => formatDate(suite.last_reviewed_at) },
          ]}
          rows={data.suites}
          rowKey={(suite) => suite.slug}
          onRowClick={(suite) => navigate(`/benchmarks/${suite.slug}`)}
          rowAriaLabel={(suite) => `Open ${suite.title} v${suite.version}`}
        />
      </section>
    </div>
  )
}

export default BenchmarksPage
