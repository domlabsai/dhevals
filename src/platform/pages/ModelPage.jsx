import { useProjection, useRunDetail, slugForModel, formatMs, formatDate } from '../data.js'
import { useSeo, breadcrumbJsonLd } from '../seo.js'
import { Link } from '../router.jsx'
import { Breadcrumbs } from '../components/Breadcrumbs.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { ScoreHero } from '../components/ScoreHero.jsx'
import { MetricStrip } from '../components/MetricStrip.jsx'
import { CategoryBars } from '../components/CategoryBars.jsx'
import { Timeline } from '../components/Timeline.jsx'
import { SourceList } from '../components/SourceList.jsx'
import { StatusDot } from '../components/StatusDot.jsx'
import { ShareMenu } from '../components/ShareMenu.jsx'
import { ExportMenu } from '../components/ExportMenu.jsx'
import { Button } from '../components/Button.jsx'
import { Skeleton } from '../components/Skeleton.jsx'
import { RUN_STATUS } from '../data.js'
import { PageLoading, PageError, StaleBanner } from './pageStates.jsx'

const RELEASE_STATUS = {
  not_configured: { color: 'amber', label: 'Not configured' },
  calibration_pending: { color: 'amber', label: 'Calibration pending' },
  ready: { color: 'lime', label: 'Ready' },
}

export function ModelPage({ slug }) {
  const { status, data, error, stale, generatedAt } = useProjection()
  const model =
    status === 'ready'
      ? data.models.find((m) => slugForModel(m) === slug || m.id === slug) ?? null
      : undefined

  const modelRuns =
    status === 'ready' && model
      ? (data.runs.entries ?? [])
          .filter((run) => run.model_id === model.id)
          .sort((a, b) => Date.parse(b.started_at ?? 0) - Date.parse(a.started_at ?? 0))
      : []

  // Prefer a non-fixture run for the category chart; fall back to the latest run.
  const chartRun = modelRuns.find((run) => !run.is_fixture) ?? modelRuns[0] ?? null
  const detail = useRunDetail(chartRun?.id ?? null)

  useSeo({
    title: model ? `${model.name} — evidence and metrics` : 'Model not found',
    description: model
      ? `${model.name} on DHEvals: evidence status, coverage, and measured performance from the public projection.`
      : 'This model is not in the DHEvals public projection.',
    path: `/models/${slug}`,
    noindex: status === 'ready' && !model,
    jsonLd:
      status === 'ready' && model
        ? breadcrumbJsonLd([
            { label: 'Leaderboard', to: '/leaderboard' },
            { label: model.name },
          ])
        : undefined,
  })

  if (status === 'loading') return <PageLoading testid="model-page" />
  if (status === 'error') return <PageError testid="model-page" error={error} />

  if (!model) {
    return (
      <div className="container section" data-testid="model-page">
        <EmptyState
          title={`“${slug}” is not in the public projection.`}
          body="Only models tracked by DHEvals appear here. Check the spelling, or browse the full list on the leaderboard."
          action={<Button to="/leaderboard">Back to leaderboard</Button>}
        />
      </div>
    )
  }

  const release = RELEASE_STATUS[model.status] ?? { color: 'cyan', label: model.status }
  const otherModel = data.models.find((m) => m.id !== model.id)
  const metrics = model.metrics ?? {}
  const hasScore = typeof model.quality_score === 'number'

  const chartFixture = chartRun?.is_fixture ?? false
  const chartCategories =
    detail.status === 'ready' && chartRun
      ? (detail.data.categories ?? []).map((category) => ({
          category: category.category,
          score: typeof category.score === 'number' ? category.score * 100 : null,
          state: 'estimated',
        }))
      : null

  const timelineItems = modelRuns.map((run) => {
    const statusMeta = RUN_STATUS[run.run_status] ?? { label: run.run_status, color: 'cyan' }
    return {
      date: run.started_at,
      color: statusMeta.color,
      label: statusMeta.label + (run.is_fixture ? ' · fixture' : ''),
      title: run.id,
      to: `/reports/${run.id}`,
      meta: `Suite v${run.suite_version} · ${run.task_count} tasks · score ${
        !run.is_fixture && typeof run.quality_score === 'number' ? run.quality_score.toFixed(1) : '—'
      }`,
    }
  })

  return (
    <div className="container section stack stack--8" data-testid="model-page">
      {stale ? <StaleBanner generatedAt={generatedAt} /> : null}

      <Breadcrumbs
        items={[
          { label: 'Leaderboard', to: '/leaderboard' },
          { label: model.name },
        ]}
      />

      <section className="stack" aria-label="Model identity">
        <p className="eyebrow">Model</p>
        <h1 className="heading-xl">{model.name}</h1>
        <div className="row">
          <span className="mono muted">{model.provider}</span>
          <StatusDot color={release.color} label={release.label} />
          <span className="badge">License: {model.license ?? '—'}</span>
        </div>
        <SourceList sources={model.sources ?? []} label="Evidence sources" />
      </section>

      <div className="grid">
        <section className="panel stack" style={{ gridColumn: 'span 5' }} aria-label="Public score">
          <ScoreHero
            score={model.quality_score}
            evidenceStatus={model.evidence_status}
            suiteName="Heavy-user pt-BR"
            suiteVersion={data.suites.find((suite) => suite.current_public)?.version}
            date={model.bench_run_date ?? model.last_verified_at}
            nullExplanation={model.notes ?? 'Not evaluated in this scope yet.'}
          />
          {model.ranking_status === 'archive_only_ranked' ? (
            <p className="notice notice--amber micro">
              Observed archive-only ranking — verified comparative evidence; human calibration is
              pending and this score is not promoted.
            </p>
          ) : null}
        </section>
        <div style={{ gridColumn: 'span 7' }} className="stack">
          <MetricStrip
            metrics={[
              {
                label: 'Cost /1k tok',
                value: typeof metrics.cost_per_1k === 'number' ? `${metrics.cost_is_estimate ? '≈' : ''}$${metrics.cost_per_1k.toFixed(4)}` : null,
              },
              {
                label: 'Run cost',
                value: typeof metrics.run_cost_usd === 'number' ? `${metrics.cost_is_estimate ? '≈' : ''}$${metrics.run_cost_usd.toFixed(4)}` : null,
              },
              {
                label: 'Latency',
                value: typeof metrics.latency_ms === 'number' ? formatMs(metrics.latency_ms) : null,
                note: metrics.observed_from_runs ? 'Observed from archive runs — context only' : undefined,
              },
              {
                label: 'Context',
                value: typeof metrics.context_tokens === 'number' ? metrics.context_tokens.toLocaleString('en-US') : null,
                unit: typeof metrics.context_tokens === 'number' ? 'tokens' : undefined,
              },
            ]}
          />
          {metrics.cost_estimate_warning ? (
            <p className="notice notice--amber micro" role="status">
              {metrics.cost_estimate_warning} Token counts from a plain-text CLI may also be estimated.
            </p>
          ) : null}
          {!hasScore ? (
            <p className="micro muted">
              {model.notes} Absence of a score is a state — not a zero.
            </p>
          ) : null}
        </div>
      </div>

      <section className="stack" aria-label="Category performance">
        <p className="eyebrow">Category performance</p>
        {chartRun == null ? (
          <EmptyState
            title="No runs recorded for this model."
            body="Category performance appears here once the model has been executed against a suite."
          />
        ) : detail.status === 'loading' ? (
          <Skeleton variant="block" height={180} />
        ) : detail.status === 'error' ? (
          <EmptyState title="Run detail unavailable." body={detail.error?.message} />
        ) : chartFixture ? (
          <>
            <CategoryBars
              items={chartCategories}
              scope={`${chartRun.suite_id} v${chartRun.suite_version} · ${formatDate(chartRun.started_at)}`}
              caption="Offline fixture run — pipeline calibration data, NOT model performance. Locked treatment applied deliberately."
            />
            <p className="notice notice--amber">
              These bars come from a locked offline fixture. They validate the scoring pipeline and
              must not be read as {model.name} performing at any level.
            </p>
          </>
        ) : (
          <>
            <CategoryBars
              items={chartCategories}
              scope={`${chartRun.suite_id} v${chartRun.suite_version} · ${formatDate(chartRun.started_at)}`}
              caption="Archive-only run — verified evidence, but not a promoted public result."
            />
            <p className="notice notice--amber">
              From an archive-only run (<Link to={`/reports/${chartRun.id}`} className="mono">{chartRun.id}</Link>).
              The promotion gate is closed, so these remain context, not a public score.
            </p>
          </>
        )}
      </section>

      <section className="stack" aria-label="Run history">
        <p className="eyebrow">Run history ({modelRuns.length})</p>
        {modelRuns.length === 0 ? (
          <EmptyState title="No runs yet." body="This model has not been executed against any suite." />
        ) : (
          <Timeline items={timelineItems} ariaLabel={`Run history for ${model.name}`} />
        )}
      </section>

      <section className="row" aria-label="Actions">
        {otherModel ? (
          <Button to={`/compare/${[slugForModel(model), slugForModel(otherModel)].sort().join('-vs-')}`} variant="primary">
            Compare with {otherModel.name}
          </Button>
        ) : null}
        <ShareMenu
          xText={`${model.name} on DHEvals — evidence status: ${model.evidence_status}, no promoted public score yet. Scope: Heavy-user pt-BR.`}
          cardHref="/brand/social/social-result.svg"
        />
        <ExportMenu
          artifacts={[
            ...modelRuns.map((run) => ({
              href: run.artifacts?.json ?? `/data/public/runs/${run.id}.json`,
              label: `Run ${run.id}`,
              kind: 'JSON',
            })),
            { href: '/data/public/models.json', label: 'models.json (all models)', kind: 'JSON' },
          ]}
          copyItems={[{ label: 'Copy model JSON link', text: `${window.location.origin}/data/public/models.json` }]}
        />
      </section>
    </div>
  )
}

export default ModelPage
