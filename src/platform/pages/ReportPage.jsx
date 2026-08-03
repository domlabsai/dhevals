import { useState } from 'react'
import {
  useProjection,
  useRunDetail,
  formatScore,
  formatDate,
  formatMs,
  formatTokens,
  RUN_STATUS,
} from '../data.js'
import { useSeo, breadcrumbJsonLd } from '../seo.js'
import { Link } from '../router.jsx'
import { Breadcrumbs } from '../components/Breadcrumbs.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { ScoreHero } from '../components/ScoreHero.jsx'
import { CoverageMeter } from '../components/CoverageMeter.jsx'
import { MetricStrip } from '../components/MetricStrip.jsx'
import { CategoryBars } from '../components/CategoryBars.jsx'
import { DataTable } from '../components/DataTable.jsx'
import { RunInspector } from '../components/RunInspector.jsx'
import { ExportMenu } from '../components/ExportMenu.jsx'
import { ShareMenu } from '../components/ShareMenu.jsx'
import { Button } from '../components/Button.jsx'
import { Skeleton } from '../components/Skeleton.jsx'
import { Icon } from '../components/icons.jsx'
import { PageLoading, PageError } from './pageStates.jsx'

const STATUS_BADGE_CLASS = {
  promoted: 'badge--lime',
  verified: 'badge--cyan',
  archive_only: 'badge--cyan',
  locked: 'badge--amber',
  invalid: 'badge--red',
}

function truncateHash(hash) {
  if (!hash) return '—'
  return hash.length > 32 ? `${hash.slice(0, 32)}…` : hash
}

export function ReportPage({ runId }) {
  const projection = useProjection()
  const detail = useRunDetail(runId)
  const [selectedTask, setSelectedTask] = useState(null)

  const indexEntry =
    projection.status === 'ready'
      ? (projection.data.runs.entries ?? []).find((run) => run.id === runId) ?? null
      : undefined

  const run = detail.status === 'ready' ? detail.data : null
  const modelName = run?.run?.model?.name ?? indexEntry?.model_name

  useSeo({
    title: run ? `Report ${runId}` : 'Run report',
    description: run
      ? `${modelName} on ${run.run.suite_id} v${run.run.suite_version}: score, coverage, task-level evidence, and provenance. Status: ${run.run_status}.`
      : 'DHEvals run report with task-level evidence and provenance.',
    path: `/reports/${runId}`,
    jsonLd:
      run && indexEntry
        ? breadcrumbJsonLd([
            { label: 'Reports', to: '/reports' },
            { label: runId },
          ])
        : undefined,
  })

  if (projection.status === 'loading' || detail.status === 'loading') {
    return (
      <div className="container section" data-testid="report-page">
        <div className="stack stack--6">
          <Skeleton lines={2} width="50%" />
          <Skeleton variant="block" height={200} />
          <Skeleton variant="block" height={320} />
        </div>
      </div>
    )
  }
  if (projection.status === 'error') return <PageError testid="report-page" error={projection.error} />

  if (detail.status === 'error') {
    return (
      <div className="container section" data-testid="report-page">
        <EmptyState
          title={`No public report for “${runId}”.`}
          body="Only runs in the public projection have reports. Check the id, or browse the run index."
          action={<Button to="/reports">All reports</Button>}
        />
      </div>
    )
  }

  const summary = run.summary ?? {}
  const isFixture = run.is_fixture
  const statusMeta = RUN_STATUS[run.run_status] ?? { label: run.run_status, color: 'cyan' }
  const publishable = !isFixture && run.run_status !== 'locked' && run.run_status !== 'invalid'
  const displayScore = publishable && typeof summary.overall_score === 'number' ? summary.overall_score : null

  const banner = isFixture
    ? run.run_status === 'invalid'
      ? { kind: 'red', text: 'Invalid offline fixture — this run failed verification by design and must not be read as a result.' }
      : { kind: 'amber', text: 'Locked offline fixture — not a public model run. Shown for transparency only; its numbers are pipeline calibration data.' }
    : run.run_status === 'archive_only'
      ? { kind: 'amber', text: 'Archive only — this run is verified but not a promoted public result.' }
      : run.run_status === 'invalid'
        ? { kind: 'red', text: 'Invalid — this run failed verification and must not be read as a result.' }
        : null

  const categoryItems = (run.categories ?? []).map((category) => ({
    category: category.category,
    score: typeof category.score === 'number' ? category.score * 100 : null,
    state: publishable ? 'verified' : 'estimated',
  }))

  const shareText =
    displayScore !== null
      ? `${modelName} scored ${formatScore(displayScore)}/100 on Heavy-user pt-BR v${run.run.suite_version} — ${summary.task_count} tasks, verified ${formatDate(run.run.finished_at)}${run.run_status === 'archive_only' ? ' (archive only, not promoted)' : ''}.`
      : `Run ${runId} on ${run.run.suite_id} v${run.run.suite_version} — status: ${run.run_status}, no public score.`

  return (
    <div className="container section stack stack--8" data-testid="report-page">
      <Breadcrumbs items={[{ label: 'Reports', to: '/reports' }, { label: runId }]} />

      <section className="stack" aria-label="Run identity">
        <p className="eyebrow">Run report</p>
        <h1 className="heading-lg mono" style={{ overflowWrap: 'anywhere' }}>{runId}</h1>
        <div className="row">
          <span>{modelName}</span>
          <span className="mono muted micro">{run.run.model?.provider}</span>
          <span className="badge badge--cobalt">{run.run.suite_id} v{run.run.suite_version}</span>
          <span className={`badge ${STATUS_BADGE_CLASS[run.run_status] ?? ''}`}>{statusMeta.label}</span>
          {isFixture ? <span className="badge badge--amber">Fixture</span> : null}
          <span className="badge">{run.verified ? 'Verified' : 'Not verified'}</span>
        </div>
        <p className="verification-line">
          ran {formatDate(run.run.started_at)} · runner v{run.run.runner_version ?? '—'}
        </p>
      </section>

      {banner ? (
        <p className={`notice notice--${banner.kind}`} role="status">
          <Icon name={banner.kind === 'red' ? 'x' : 'lock'} />
          <span>{banner.text}</span>
        </p>
      ) : null}

      <div className="grid">
        <section className="panel stack" style={{ gridColumn: 'span 5' }} aria-label="Score">
          <ScoreHero
            score={displayScore}
            suiteName={run.run.suite_id}
            suiteVersion={run.run.suite_version}
            date={run.run.finished_at}
            nullExplanation={
              isFixture
                ? 'Offline fixture — no public score exists for this run.'
                : 'No publishable score — this run is not a promoted result.'
            }
          />
          <CoverageMeter coverage={summary.coverage} completed={summary.completed_count} total={summary.task_count} />
        </section>
        <div style={{ gridColumn: 'span 7' }} className="stack">
          <MetricStrip
            metrics={[
              { label: 'Tasks', value: summary.task_count },
              { label: 'Completed', value: summary.completed_count },
              { label: 'Errors', value: summary.error_count },
              {
                label: 'Est. cost',
                value: typeof summary.estimated_cost_usd_total === 'number' ? `$${summary.estimated_cost_usd_total.toFixed(3)}` : null,
                unit: 'USD',
              },
            ]}
          />
        </div>
      </div>

      <section className="stack" aria-label="Category breakdown">
        <p className="eyebrow">Category breakdown</p>
        <CategoryBars
          items={categoryItems}
          scope={`${run.run.suite_id} v${run.run.suite_version} · ${formatDate(run.run.finished_at)}`}
          caption={
            isFixture
              ? 'Offline fixture — amber/hatched treatment; not model performance.'
              : publishable
                ? 'Verified run evidence.'
                : 'Not a promoted result — treat as approximate context.'
          }
        />
      </section>

      <section className="stack" aria-label="Tasks">
        <p className="eyebrow">Tasks ({run.tasks?.length ?? 0})</p>
        <DataTable
          caption={`Task-level results for run ${runId}. Select a row to inspect its evidence.`}
          columns={[
            {
              key: 'title',
              label: 'Task',
              render: (task) => (
                <span className="stack stack--2" style={{ gap: 2 }}>
                  <span lang="pt-BR">{task.title}</span>
                  <span className="mono micro faint">{task.task_id}</span>
                </span>
              ),
            },
            { key: 'category', label: 'Category', render: (task) => <span className="badge">{task.category}</span> },
            {
              key: 'status',
              label: 'Status',
              render: (task) => (
                <span className={`badge ${task.status === 'pass' ? 'badge--lime' : task.status === 'partial' ? 'badge--amber' : 'badge--red'}`}>
                  <Icon name={task.status === 'pass' ? 'check' : task.status === 'partial' ? 'tilde' : 'x'} size={12} />
                  {task.status}
                </span>
              ),
            },
            {
              key: 'score',
              label: 'Score',
              numeric: true,
              render: (task) => (typeof task.score === 'number' ? `${Math.round(task.score * 100)}%` : null),
            },
            { key: 'latency_ms', label: 'Latency', numeric: true, render: (task) => formatMs(task.latency_ms) },
            { key: 'tokens', label: 'Tokens', numeric: true, render: (task) => formatTokens(task.tokens) },
            { key: 'failure_reason', label: 'Failure reason', render: (task) => (task.failure_reason ? <span className="micro">{task.failure_reason}</span> : null) },
          ]}
          rows={run.tasks ?? []}
          rowKey={(task) => task.task_id}
          onRowClick={(task) => setSelectedTask(task)}
          rowAriaLabel={(task) => `Inspect evidence for ${task.title}`}
        />
        <RunInspector
          task={selectedTask}
          open={selectedTask !== null}
          onClose={() => setSelectedTask(null)}
        />
      </section>

      <section className="panel stack" aria-label="Provenance">
        <p className="eyebrow">Provenance</p>
        <dl className="detail-grid">
          <div>
            <dt>Manifest hash</dt>
            <dd className="mono micro" title={run.provenance?.manifest_hash}>{truncateHash(run.provenance?.manifest_hash)}</dd>
          </div>
          <div>
            <dt>Runner version</dt>
            <dd className="mono micro">{run.provenance?.runner_version ?? '—'}</dd>
          </div>
          <div>
            <dt>Source report</dt>
            <dd className="mono micro">{run.provenance?.source_report ?? '—'}</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd className="mono micro">
              {run.verification?.status ?? '—'}
              {run.verification?.details?.verified_at ? ` · ${formatDate(run.verification.details.verified_at)}` : ''}
            </dd>
          </div>
        </dl>
      </section>

      <section className="row" aria-label="Export and share">
        <ExportMenu
          artifacts={[
            { href: `/data/public/runs/${runId}.json`, label: `${runId}.json`, kind: 'JSON' },
            { href: '/data/public/runs.json', label: 'runs.json (index)', kind: 'JSON' },
          ]}
          copyItems={[{ label: 'Copy run JSON link', text: `${window.location.origin}/data/public/runs/${runId}.json` }]}
        />
        <ShareMenu xText={shareText} cardHref="/brand/social/social-report.svg" />
      </section>

      <section className="social-preview" aria-label="Social preview">
        <p className="eyebrow">Social preview 1200×630</p>
        <img src="/brand/social/social-report.svg" alt={`Social card preview for run ${runId}`} width={600} height={315} />
        <p className="micro faint">Static card served from /brand/social/.</p>
      </section>

      <p className="micro faint">
        Suite task prompts are public; responses are recorded verbatim. Read the{' '}
        <Link to="/methodology">methodology</Link> before comparing this run to anything else.
      </p>
    </div>
  )
}

export default ReportPage
