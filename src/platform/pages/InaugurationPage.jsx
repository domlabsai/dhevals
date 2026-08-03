import { useInauguration, formatDate, formatScore } from '../data.js'
import { useSeo, breadcrumbJsonLd } from '../seo.js'
import { Link } from '../router.jsx'
import { Breadcrumbs } from '../components/Breadcrumbs.jsx'
import { CoverageMeter } from '../components/CoverageMeter.jsx'
import { DataTable } from '../components/DataTable.jsx'
import { MetricStrip } from '../components/MetricStrip.jsx'
import { MethodologyCallout } from '../components/MethodologyCallout.jsx'
import { PageLoading, PageError } from './pageStates.jsx'

export function InaugurationPage() {
  const { status, data, error } = useInauguration()

  useSeo({
    title: 'DHEvals Inauguration Report',
    description:
      'The first three DHEvals heavy-user evaluation stages: versioned suites, verified coverage, quality findings, and the timeout-resilience result.',
    path: '/reports/inauguration',
    image: '/brand/social/social-report.svg',
    jsonLd: breadcrumbJsonLd([
      { label: 'Reports', to: '/reports' },
      { label: 'Inauguration report' },
    ]),
  })

  if (status === 'loading') return <PageLoading testid="inauguration-page" height={260} />
  if (status === 'error') return <PageError testid="inauguration-page" error={error} />

  const overall = data.overall
  const timeoutPolicy = data.timeout_policy
  const qualityFailures = data.stages.flatMap((stage) => stage.quality_failures ?? [])

  return (
    <div className="container section stack stack--8" data-testid="inauguration-page">
      <Breadcrumbs items={[{ label: 'Reports', to: '/reports' }, { label: 'Inauguration report' }]} />

      <header className="stack reading">
        <p className="eyebrow">DHEvals inauguration · archive report</p>
        <h1 className="heading-xl">The first three stages are in.</h1>
        <p className="body-lg muted">
          A transparent opening record for DHEvals: one model, three versioned Heavy-user pt-BR suites,
          and every task result accompanied by coverage, checks, and provenance.
        </p>
      </header>

      <p className="notice notice--amber" role="status">
        This is an archive-only inauguration report. The scores are verified evaluation evidence, not a
        promoted leaderboard ranking; human calibration and the release gate remain pending.
      </p>

      <MetricStrip
        metrics={[
          { label: 'Stages', value: overall.stage_count },
          { label: 'Tasks', value: overall.task_count },
          { label: 'Coverage', value: `${Math.round(overall.coverage * 100)}%` },
          { label: 'Task-weighted score', value: formatScore(overall.task_weighted_score * 100), unit: '/100' },
        ]}
      />

      <section className="stack" aria-label="Stage results">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="stack stack--2">
            <p className="eyebrow">Stage results</p>
            <h2 className="heading-md">Three suites, one evidence trail.</h2>
          </div>
          <span className="badge badge--amber">Archive only</span>
        </div>
        <DataTable
          caption="The three inauguration stages. Scores are deterministic task-check aggregates and all stages have full task coverage."
          columns={[
            {
              key: 'suite_version',
              label: 'Stage',
              render: (stage) => (
                <span className="stack stack--2" style={{ gap: 2 }}>
                  <span>{stage.label}</span>
                  <span className="mono micro faint">Heavy-user pt-BR v{stage.suite_version}</span>
                </span>
              ),
            },
            { key: 'score', label: 'Score', unit: '/100', numeric: true, render: (stage) => formatScore(stage.score * 100) },
            { key: 'coverage', label: 'Coverage', numeric: true, render: (stage) => `${Math.round(stage.coverage * 100)}%` },
            { key: 'task_count', label: 'Tasks', numeric: true },
            {
              key: 'status_counts',
              label: 'Checks',
              render: (stage) => `${stage.status_counts.pass} pass · ${stage.status_counts.partial} partial · ${stage.status_counts.fail} fail`,
            },
            {
              key: 'detail_path',
              label: 'Evidence',
              render: (stage) => <Link to={stage.detail_path} className="label">Open run →</Link>,
            },
          ]}
          rows={data.stages}
          rowKey={(stage) => stage.run_id}
        />
      </section>

      <section className="grid" aria-label="Reliability and quality">
        <div className="panel stack" style={{ gridColumn: 'span 6' }}>
          <p className="eyebrow">Timeout resilience</p>
          <h2 className="heading-md">Slow work stayed observable.</h2>
          <p className="muted">
            One task exceeded the first {timeoutPolicy.per_attempt_seconds}-second window. The runner cleaned
            up the process group and retried once with a {timeoutPolicy.retry_backoff}× budget; it completed
            without leaving an infrastructure error.
          </p>
          <dl className="detail-grid">
            <div><dt>Unresolved timeouts</dt><dd className="mono">{overall.unresolved_infrastructure_errors}</dd></div>
            <div><dt>Retry-resolved</dt><dd className="mono">{overall.retry_resolved_timeouts}</dd></div>
            <div><dt>Quality failures</dt><dd className="mono">{overall.quality_failures}</dd></div>
          </dl>
        </div>
        <div className="panel stack" style={{ gridColumn: 'span 6' }}>
          <p className="eyebrow">Quality findings</p>
          <h2 className="heading-md">Failures remain failures.</h2>
          <p className="muted">
            Deterministic checks are not softened by the retry policy. The following task-level findings are
            retained for the next rubric and prompt iteration.
          </p>
          {qualityFailures.length ? (
            <ul className="stack stack--2">
              {qualityFailures.map((failure) => <li key={failure} className="mono micro">{failure}</li>)}
            </ul>
          ) : <p className="mono micro">No quality failures recorded.</p>}
        </div>
      </section>

      <section className="panel stack" aria-label="Model and methodology">
        <p className="eyebrow">Scope</p>
        <h2 className="heading-md">What this report establishes.</h2>
        <p className="muted">
          {data.model.model_id} was evaluated through the OpenCode CLI against the versioned
          <span className="mono"> {data.methodology.suite_id}</span> suite in Brazilian Portuguese.
          The report establishes reproducible coverage and task-level behavior across the three stages; it
          does not claim a universal model ranking.
        </p>
        <div className="grid">
          {data.stages.map((stage) => (
            <div className="stack stack--2" key={`${stage.run_id}-provenance`}>
              <span className="label">v{stage.suite_version} manifest</span>
              <span className="mono micro faint" style={{ overflowWrap: 'anywhere' }}>{stage.suite_hash}</span>
              <span className="micro muted">Verified {formatDate(stage.finished_at)}</span>
            </div>
          ))}
        </div>
      </section>

      <CoverageMeter coverage={overall.coverage} completed={overall.completed_count} total={overall.task_count} />
      <MethodologyCallout>
        These inauguration scores are a starting evidence record. Read each run with its suite version,
        manifest hash, task outcomes, and archive-only status attached.
      </MethodologyCallout>
    </div>
  )
}

export default InaugurationPage
