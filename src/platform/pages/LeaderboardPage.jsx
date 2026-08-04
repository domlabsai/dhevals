import { useMemo } from 'react'
import { useProjection } from '../data.js'
import { useSeo } from '../seo.js'
import { useQuery, useNavigate, useLocation, Link } from '../router.jsx'
import { FilterBar } from '../components/FilterBar.jsx'
import { LeaderboardTable } from '../components/LeaderboardTable.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { Button } from '../components/Button.jsx'
import { ShareMenu } from '../components/ShareMenu.jsx'
import { PageLoading, PageError, StaleBanner } from './pageStates.jsx'

const SORT_OPTIONS = [
  { value: 'quality_desc', label: 'Quality — high to low' },
  { value: 'quality_asc', label: 'Quality — low to high' },
  { value: 'name_asc', label: 'Name — A to Z' },
  { value: 'verified_desc', label: 'Recently verified first' },
]

const DEFAULT_SORT = 'quality_desc'
const KNOWN_KEYS = ['q', 'provider', 'category', 'suite', 'license', 'evidence', 'sort']
const MULTI_KEYS = ['provider', 'category', 'suite', 'license', 'evidence']

function readFilters(query) {
  const filters = { q: '', sort: DEFAULT_SORT }
  for (const key of MULTI_KEYS) filters[key] = []
  for (const key of KNOWN_KEYS) {
    const raw = query.get(key)
    if (raw === null) continue
    if (key === 'q') filters.q = raw
    else if (key === 'sort') {
      if (SORT_OPTIONS.some((option) => option.value === raw)) filters.sort = raw
    } else {
      filters[key] = raw.split(',').map((value) => value.trim()).filter(Boolean)
    }
  }
  return filters
}

function buildQuery(filters) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  for (const key of MULTI_KEYS) {
    if (filters[key].length) params.set(key, filters[key].join(','))
  }
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort)
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function LeaderboardPage() {
  useSeo({
    title: 'Leaderboard',
    description:
      'The DHEvals public leaderboard. Observed archive-only rankings are shown transparently; promoted scores require calibration and review.',
    path: '/leaderboard',
  })
  const { status, data, error, stale, generatedAt } = useProjection()
  const query = useQuery()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const filters = useMemo(() => readFilters(query), [query])

  const setFilters = (next) => {
    navigate(`${pathname}${buildQuery(next)}`, { replace: true })
  }

  if (status === 'loading') return <PageLoading testid="leaderboard-page" />
  if (status === 'error') return <PageError testid="leaderboard-page" error={error} />

  const { ranked, not_ranked: notRanked } = data.leaderboard
  const modelsById = new Map(data.models.map((model) => [model.id, model]))

  const rankedEntries = ranked.map((entry) => {
    const model = modelsById.get(entry.model_id) ?? null
    return {
      ...entry,
      slug: model?.slug ?? entry.model_id,
      reason: 'archive_only',
      model: model ? { ...model, quality_score: entry.quality_score } : { quality_score: entry.quality_score },
    }
  })
  const entries = notRanked.map((entry) => {
    const model = modelsById.get(entry.model_id) ?? null
    return { ...entry, slug: model?.slug ?? entry.model_id, model }
  })
  const allEntries = [...rankedEntries, ...entries]

  /* Filter options are populated from the data itself. */
  const providerOptions = [...new Set(allEntries.map((entry) => entry.provider))].sort()
  const categoryOptions = [...new Set(data.models.flatMap((model) => model.capabilities ?? []))].sort()
  const suiteOptions = data.suites.map((suite) => ({ value: suite.slug, label: `v${suite.version} — ${suite.title}` }))
  const licenseOptions = [...new Set(data.models.map((model) => model.license).filter(Boolean))].sort()
  const evidenceOptions = [...new Set(allEntries.map((entry) => entry.evidence_status))].sort()

  const suiteVersionBySlug = new Map(data.suites.map((suite) => [suite.slug, suite.version]))
  const runsIndex = data.runs.entries ?? []

  const filtered = allEntries.filter((entry) => {
    const model = entry.model
    if (filters.q) {
      const haystack = `${entry.model_name} ${entry.provider}`.toLowerCase()
      if (!haystack.includes(filters.q.toLowerCase())) return false
    }
    if (filters.provider.length && !filters.provider.includes(entry.provider)) return false
    if (filters.evidence.length && !filters.evidence.includes(entry.evidence_status)) return false
    if (filters.license.length && !filters.license.includes(model?.license)) return false
    if (filters.category.length) {
      const capabilities = model?.capabilities ?? []
      if (!filters.category.some((category) => capabilities.includes(category))) return false
    }
    if (filters.suite.length) {
      const versions = filters.suite.map((slug) => suiteVersionBySlug.get(slug)).filter(Boolean)
      const participates = runsIndex.some(
        (run) => run.model_id === entry.model_id && versions.includes(run.suite_version),
      )
      if (!participates) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const qualityA = a.model?.quality_score
    const qualityB = b.model?.quality_score
    const hasA = typeof qualityA === 'number'
    const hasB = typeof qualityB === 'number'
    switch (filters.sort) {
      case 'quality_desc':
        if (hasA !== hasB) return hasA ? -1 : 1
        if (hasA && hasB && qualityA !== qualityB) return qualityB - qualityA
        return a.model_name.localeCompare(b.model_name)
      case 'quality_asc':
        if (hasA !== hasB) return hasA ? -1 : 1
        if (hasA && hasB && qualityA !== qualityB) return qualityA - qualityB
        return a.model_name.localeCompare(b.model_name)
      case 'verified_desc': {
        const timeA = Date.parse(a.model?.bench_run_date ?? a.model?.last_verified_at ?? 0) || 0
        const timeB = Date.parse(b.model?.bench_run_date ?? b.model?.last_verified_at ?? 0) || 0
        if (timeA !== timeB) return timeB - timeA
        return a.model_name.localeCompare(b.model_name)
      }
      case 'name_asc':
      default:
        return a.model_name.localeCompare(b.model_name)
    }
  })
  const filteredRanked = sorted.filter((entry) => entry.ranking_status === 'archive_only_ranked')
  const filteredNotRanked = sorted.filter((entry) => entry.ranking_status !== 'archive_only_ranked')

  const chips = []
  if (filters.q) {
    chips.push({ key: 'q', label: `Search: “${filters.q}”`, onRemove: () => setFilters({ ...filters, q: '' }) })
  }
  for (const key of MULTI_KEYS) {
    for (const value of filters[key]) {
      const dimension = key[0].toUpperCase() + key.slice(1)
      chips.push({
        key: `${key}:${value}`,
        label: `${dimension}: ${value}`,
        onRemove: () => setFilters({ ...filters, [key]: filters[key].filter((v) => v !== value) }),
      })
    }
  }

  const selectFor = (key, label, options, allLabel) => ({
    key,
    label,
    value: filters[key][0] ?? '',
    options: [{ value: '', label: allLabel }, ...options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option))],
    onChange: (value) => setFilters({ ...filters, [key]: value ? [value] : [] }),
  })

  return (
    <div className="container section stack stack--6" data-testid="leaderboard-page">
      {stale ? <StaleBanner generatedAt={generatedAt} /> : null}

      <header className="stack reading">
        <p className="eyebrow">Leaderboard</p>
        <h1 className="heading-xl">Public ranking</h1>
        <p className="body-lg muted">
          Observed archive-only runs with full coverage and verified provenance are ranked for
          comparison. Human calibration is still required before any score is promoted.
        </p>
      </header>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <ShareMenu
          xText={null}
          cardHref={null}
        />
      </div>

      <FilterBar
        search={{
          value: filters.q,
          onChange: (value) => setFilters({ ...filters, q: value }),
          placeholder: 'Search models or providers…',
        }}
        selects={[
          selectFor('provider', 'Provider', providerOptions, 'All providers'),
          selectFor('category', 'Workload', categoryOptions, 'All workloads'),
          selectFor('suite', 'Suite', suiteOptions, 'All suites'),
          selectFor('license', 'License', licenseOptions, 'All licenses'),
          selectFor('evidence', 'Evidence', evidenceOptions, 'All evidence states'),
        ]}
        sort={{
          value: filters.sort,
          options: SORT_OPTIONS,
          onChange: (value) => setFilters({ ...filters, sort: value }),
        }}
        chips={chips}
        onReset={() => setFilters({ q: '', sort: DEFAULT_SORT, provider: [], category: [], suite: [], license: [], evidence: [] })}
        resultCount={sorted.length}
      />

      <section className="stack" aria-label="Ranked models">
        <p className="eyebrow">Observed archive-only ranking ({filteredRanked.length})</p>
        {filteredRanked.length === 0 ? (
          <EmptyState
            title="No observed rankings match these filters."
            body="A model needs a verified, full-coverage archive run before it can appear in this comparative view."
            action={<Button to="/methodology" variant="secondary" size="sm">Read the methodology</Button>}
          />
        ) : (
          <LeaderboardTable
            entries={filteredRanked}
            mode="ranked"
            onOpenModel={(slug) => navigate(`/models/${slug}`)}
          />
        )}
      </section>

      <section className="stack" aria-label="Not yet ranked">
        <p className="eyebrow">Not yet ranked ({filteredNotRanked.length})</p>
        {filteredNotRanked.length === 0 ? (
          <EmptyState
            title="No additional models are waiting for ranking."
            body="New models will appear here after a verified archive run or while their evidence is incomplete."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFilters({ q: '', sort: DEFAULT_SORT, provider: [], category: [], suite: [], license: [], evidence: [] })}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <LeaderboardTable
            entries={filteredNotRanked}
            onOpenModel={(slug) => navigate(`/models/${slug}`)}
          />
        )}
        <p className="micro faint">
          Archive-only rankings are comparative evidence, not promoted certification. Fixture scores are never published.
          {' '}<Link to="/methodology">Methodology</Link> · Generated {data.leaderboard.generated_at?.slice(0, 10)}
        </p>
      </section>
    </div>
  )
}

export default LeaderboardPage
