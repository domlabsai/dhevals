import { useProjection, useRunDetail, formatDate } from '../data.js'
import { useSeo, breadcrumbJsonLd, datasetJsonLd } from '../seo.js'
import { Link } from '../router.jsx'
import { Breadcrumbs } from '../components/Breadcrumbs.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { StatusDot } from '../components/StatusDot.jsx'
import { CoverageMeter } from '../components/CoverageMeter.jsx'
import { Button } from '../components/Button.jsx'
import { Skeleton } from '../components/Skeleton.jsx'
import { Icon } from '../components/icons.jsx'
import { PageLoading, PageError, StaleBanner } from './pageStates.jsx'

const SUITE_STATUS = {
  fixture_only: { color: 'amber', label: 'Fixture only' },
  calibration_pending: { color: 'amber', label: 'Calibration pending' },
  calibrated: { color: 'lime', label: 'Calibrated' },
}

const CHECK_TYPE_DOCS = [
  { type: 'contains_all', text: 'The response must include every required phrase (case-insensitive).' },
  { type: 'contains_any', text: 'The response must include at least one of the listed phrases.' },
  { type: 'not_contains', text: 'The response must not include forbidden phrases (e.g. fabricated citations).' },
  { type: 'min_length', text: 'The response must reach a minimum character length.' },
  { type: 'regex', text: 'The response must match a structural pattern (e.g. a numbered section).' },
  { type: 'json_object', text: 'The response must parse as a JSON object with the required keys.' },
]

export function SuitePage({ suiteSlug }) {
  const { status, data, error, stale, generatedAt } = useProjection()
  const suite = status === 'ready' ? data.suites.find((s) => s.slug === suiteSlug) ?? null : undefined

  // Task counts per category come from a public run against this suite version.
  const suiteRun =
    status === 'ready' && suite
      ? (data.runs.entries ?? [])
          .filter((run) => run.suite_id === suite.id && run.suite_version === suite.version)
          .sort((a, b) => Date.parse(b.started_at ?? 0) - Date.parse(a.started_at ?? 0))[0] ?? null
      : null
  const detail = useRunDetail(suiteRun?.id ?? null)

  useSeo({
    title: suite ? `${suite.title} v${suite.version}` : 'Suite not found',
    description: suite
      ? `${suite.title} v${suite.version}: ${suite.task_count} Brazilian-Portuguese heavy-user tasks, ${suite.dimension_count} scoring dimensions, hash-pinned manifest.`
      : 'This suite is not in the DHEvals public projection.',
    path: `/benchmarks/${suiteSlug}`,
    noindex: status === 'ready' && !suite,
    jsonLd:
      status === 'ready' && suite
        ? [
            breadcrumbJsonLd([
              { label: 'Benchmarks', to: '/benchmarks' },
              { label: `${suite.title} v${suite.version}` },
            ]),
            datasetJsonLd({
              name: `${suite.title} v${suite.version}`,
              description: suite.description,
              path: `/benchmarks/${suite.slug}`,
            }),
          ]
        : undefined,
  })

  if (status === 'loading') return <PageLoading testid="suite-page" />
  if (status === 'error') return <PageError testid="suite-page" error={error} />

  if (!suite) {
    return (
      <div className="container section" data-testid="suite-page">
        <EmptyState
          title={`“${suiteSlug}” is not a published suite.`}
          body="Check the version in the URL — suites are versioned, and only published versions appear here."
          action={<Button to="/benchmarks">All benchmark suites</Button>}
        />
      </div>
    )
  }

  const statusMeta = SUITE_STATUS[suite.status] ?? { color: 'cyan', label: suite.status }
  const categoryCounts =
    detail.status === 'ready'
      ? new Map((detail.data.categories ?? []).map((c) => [c.category, c.task_count]))
      : null

  return (
    <div className="container section stack stack--8" data-testid="suite-page">
      {stale ? <StaleBanner generatedAt={generatedAt} /> : null}

      <Breadcrumbs
        items={[{ label: 'Benchmarks', to: '/benchmarks' }, { label: `v${suite.version}` }]}
      />

      <section className="stack" aria-label="Suite identity">
        <p className="eyebrow">Benchmark suite</p>
        <div className="row">
          <h1 className="heading-xl">{suite.title}</h1>
          <span className="badge badge--cobalt badge--md">v{suite.version}</span>
          {suite.current_public ? <span className="badge badge--lime badge--md">Current public</span> : null}
        </div>
        <div className="row">
          <StatusDot color={statusMeta.color} label={statusMeta.label} />
          <span className="badge">{suite.language}</span>
          <span className="badge">{suite.task_count} tasks</span>
          <span className="badge">{suite.dimension_count} scoring dimensions</span>
        </div>
        <p className="body-lg muted">
          This suite measures how a model handles real, multi-step knowledge work in Brazilian
          Portuguese — not trivia. <span lang="pt-BR">{suite.description}</span>
        </p>
        <dl className="detail-grid" style={{ maxWidth: 720 }}>
          <div>
            <dt>Manifest hash</dt>
            <dd className="mono micro" style={{ overflowWrap: 'anywhere' }}>{suite.manifest_hash}</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd className="micro">{suite.license}</dd>
          </div>
          <div>
            <dt>Last reviewed</dt>
            <dd>{formatDate(suite.last_reviewed_at)}</dd>
          </div>
          <div>
            <dt>Manifest path (public repo)</dt>
            <dd className="mono micro">benchmarks/suites/heavy-user-ptbr/v{suite.version}/</dd>
          </div>
        </dl>
      </section>

      <section className="calibration-band" aria-label="Calibration status">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p className="eyebrow">Calibration status</p>
          <span className="badge badge--amber">
            <Icon name="clock" size={12} /> Required before promotion
          </span>
        </div>
        {suite.calibration.required_groups ? (
          <>
            <CoverageMeter
              coverage={suite.calibration.completed_groups / suite.calibration.required_groups}
              completed={suite.calibration.completed_groups}
              total={suite.calibration.required_groups}
              unitLabel="anchor groups"
            />
            <p className="micro muted">
              {suite.calibration.completed_groups} of {suite.calibration.required_groups} human anchor groups
              reviewed. Scores from this suite stay locked until calibration completes and passes review.
            </p>
          </>
        ) : (
          <p className="micro muted">
            Calibration is not applicable to this fixture-only version; it exists to develop the pipeline.
          </p>
        )}
      </section>

      <section className="stack" aria-label="Categories">
        <p className="eyebrow">Task categories ({suite.categories.length})</p>
        {categoryCounts === null && suiteRun ? (
          <Skeleton lines={2} width="60%" />
        ) : null}
        <ul className="stack stack--2">
          {suite.categories.map((category) => (
            <li key={category} className="row" style={{ justifyContent: 'space-between', borderBottom: 'var(--border-hairline)', paddingBottom: 'var(--space-2)' }}>
              <Link to={`/leaderboard?category=${encodeURIComponent(category)}`}>{category}</Link>
              <span className="mono micro faint">
                {categoryCounts?.get(category) != null ? `${categoryCounts.get(category)} task${categoryCounts.get(category) === 1 ? '' : 's'}` : '—'}
              </span>
            </li>
          ))}
        </ul>
        {suiteRun ? (
          <p className="micro faint">
            Task counts from run <Link to={`/reports/${suiteRun.id}`} className="mono">{suiteRun.id}</Link>
            {suiteRun.is_fixture ? ' (offline fixture — structural data only)' : ''}.
          </p>
        ) : null}
      </section>

      <section className="stack" aria-label="Scoring">
        <p className="eyebrow">How this suite scores</p>
        <p className="muted" style={{ maxWidth: '72ch' }}>
          Each task is scored by deterministic checks — no model judging itself. Task scores average
          into the suite score (0–100); coverage is reported separately. The suite defines{' '}
          {suite.dimension_count} scoring dimensions across {suite.task_count} tasks.
        </p>
        <ul className="stack stack--2">
          {CHECK_TYPE_DOCS.map((check) => (
            <li key={check.type} className="row">
              <code className="badge mono">{check.type}</code>
              <span className="micro muted">{check.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" aria-label="Limitations">
        <p className="eyebrow">Limitations</p>
        <ul className="stack stack--2" style={{ maxWidth: '72ch' }}>
          <li className="muted">Single locale: pt-BR only — results say nothing about other languages.</li>
          <li className="muted">Small task count ({suite.task_count}); one task per category in most categories.</li>
          <li className="muted">Calibration incomplete — scores stay locked until human anchor review finishes.</li>
        </ul>
      </section>

      <section className="row" aria-label="Suite actions">
        <Button href="/data/public/suites.json" variant="secondary" icon="download">Download suites.json</Button>
        <Button to="/data" variant="quiet">All downloads →</Button>
        <Button to="/methodology" variant="quiet">Methodology →</Button>
      </section>
    </div>
  )
}

export default SuitePage
