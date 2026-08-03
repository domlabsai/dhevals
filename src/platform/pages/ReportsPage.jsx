import { useMemo } from 'react'
import { useProjection, formatScore, formatDate, RUN_STATUS } from '../data.js'
import { useSeo } from '../seo.js'
import { useQuery, useNavigate, useLocation } from '../router.jsx'
import { FilterBar } from '../components/FilterBar.jsx'
import { DataTable } from '../components/DataTable.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { Button } from '../components/Button.jsx'
import { Link } from '../router.jsx'
import { PageLoading, PageError, StaleBanner } from './pageStates.jsx'

const STATUS_BADGE_CLASS = {
  promoted: 'badge--lime',
  verified: 'badge--cyan',
  archive_only: 'badge--cyan',
  locked: 'badge--amber',
  invalid: 'badge--red',
}

function readFilters(query) {
  return {
    q: query.get('q') ?? '',
    run_status: query.get('run_status') ?? '',
    suite: query.get('suite') ?? '',
  }
}

function buildQuery(filters) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.run_status) params.set('run_status', filters.run_status)
  if (filters.suite) params.set('suite', filters.suite)
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function ReportsPage() {
  useSeo({
    title: 'Run reports',
    description:
      'Every DHEvals run with its evidence: scores, coverage, checks, and provenance. Archive-only and fixture runs are shown for transparency, never promoted.',
    path: '/reports',
  })
  const { status, data, error, stale, generatedAt } = useProjection()
  const query = useQuery()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const filters = useMemo(() => readFilters(query), [query])
  const setFilters = (next) => navigate(`${pathname}${buildQuery(next)}`, { replace: true })

  if (status === 'loading') return <PageLoading testid="reports-page" />
  if (status === 'error') return <PageError testid="reports-page" error={error} />

  const entries = [...(data.runs.entries ?? [])].sort(
    (a, b) => Date.parse(b.started_at ?? 0) - Date.parse(a.started_at ?? 0),
  )

  const statusOptions = [...new Set(entries.map((run) => run.run_status))].sort()
  const suiteOptions = [...new Set(entries.map((run) => `v${run.suite_version}`))].sort()

  const filtered = entries.filter((run) => {
    if (filters.q) {
      const haystack = `${run.id} ${run.model_name} ${run.provider}`.toLowerCase()
      if (!haystack.includes(filters.q.toLowerCase())) return false
    }
    if (filters.run_status && run.run_status !== filters.run_status) return false
    if (filters.suite && `v${run.suite_version}` !== filters.suite) return false
    return true
  })

  const chips = []
  if (filters.q) chips.push({ key: 'q', label: `Search: “${filters.q}”`, onRemove: () => setFilters({ ...filters, q: '' }) })
  if (filters.run_status) chips.push({ key: 'run_status', label: `Status: ${(RUN_STATUS[filters.run_status] ?? {}).label ?? filters.run_status}`, onRemove: () => setFilters({ ...filters, run_status: '' }) })
  if (filters.suite) chips.push({ key: 'suite', label: `Suite: ${filters.suite}`, onRemove: () => setFilters({ ...filters, suite: '' }) })

  const publishableScore = (run) =>
    !run.is_fixture && run.run_status !== 'locked' && run.run_status !== 'invalid' && typeof run.quality_score === 'number'

  return (
    <div className="container section stack stack--6" data-testid="reports-page">
      {stale ? <StaleBanner generatedAt={generatedAt} /> : null}

      <header className="stack reading">
        <p className="eyebrow">Reports</p>
        <h1 className="heading-xl">Run reports</h1>
        <p className="body-lg muted">
          Every run the lab has recorded, with its status attached. Archive-only and fixture runs are
          shown for transparency and are never presented as promoted results.
        </p>
      </header>

      <FilterBar
        search={{
          value: filters.q,
          onChange: (value) => setFilters({ ...filters, q: value }),
          placeholder: 'Search run id, model, provider…',
        }}
        selects={[
          {
            key: 'run_status',
            label: 'Run status',
            value: filters.run_status,
            options: [
              { value: '', label: 'All statuses' },
              ...statusOptions.map((value) => ({ value, label: (RUN_STATUS[value] ?? {}).label ?? value })),
            ],
            onChange: (value) => setFilters({ ...filters, run_status: value }),
          },
          {
            key: 'suite',
            label: 'Suite version',
            value: filters.suite,
            options: [{ value: '', label: 'All versions' }, ...suiteOptions.map((value) => ({ value, label: value }))],
            onChange: (value) => setFilters({ ...filters, suite: value }),
          },
        ]}
        chips={chips}
        onReset={() => setFilters({ q: '', run_status: '', suite: '' })}
        resultCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No runs match these filters."
          body="Reset the filters to see every recorded run."
          action={<Button variant="secondary" size="sm" onClick={() => setFilters({ q: '', run_status: '', suite: '' })}>Reset filters</Button>}
        />
      ) : (
        <DataTable
          caption="All recorded runs. Archive-only and fixture runs are shown for transparency and are never presented as promoted results."
          sticky
          columns={[
            {
              key: 'id',
              label: 'Run',
              render: (run) => <Link to={`/reports/${run.id}`} className="mono micro">{run.id}</Link>,
            },
            { key: 'model_name', label: 'Model' },
            { key: 'suite_version', label: 'Suite', render: (run) => `v${run.suite_version}` },
            {
              key: 'quality_score',
              label: 'Score',
              unit: '/100',
              numeric: true,
              render: (run) => (publishableScore(run) ? formatScore(run.quality_score) : null),
            },
            {
              key: 'coverage',
              label: 'Coverage',
              numeric: true,
              render: (run) => (typeof run.coverage === 'number' ? `${Math.round(run.coverage * 100)}%` : null),
            },
            {
              key: 'run_status',
              label: 'Status',
              render: (run) => {
                const meta = RUN_STATUS[run.run_status] ?? { label: run.run_status }
                return <span className={`badge ${STATUS_BADGE_CLASS[run.run_status] ?? ''}`}>{meta.label}</span>
              },
            },
            {
              key: 'verified',
              label: 'Verified',
              render: (run) => (run.verified ? 'Yes' : run.run_status === 'invalid' ? 'No' : null),
            },
            { key: 'started_at', label: 'Date', render: (run) => formatDate(run.started_at) },
            {
              key: 'is_fixture',
              label: 'Type',
              render: (run) => (run.is_fixture ? <span className="badge badge--amber">Fixture</span> : <span className="micro muted">Model run</span>),
            },
          ]}
          rows={filtered}
          rowKey={(run) => run.id}
          onRowClick={(run) => navigate(`/reports/${run.id}`)}
          rowAriaLabel={(run) => `Open report ${run.id}`}
        />
      )}
    </div>
  )
}

export default ReportsPage
