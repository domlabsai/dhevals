import { useEffect, useMemo, useState } from 'react'
import { useProjection, slugForModel, formatScore, formatDate } from '../data.js'
import { useSeo, breadcrumbJsonLd } from '../seo.js'
import { useNavigate } from '../router.jsx'
import { Breadcrumbs } from '../components/Breadcrumbs.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { EvidenceBadge } from '../components/EvidenceBadge.jsx'
import { Delta } from '../components/Delta.jsx'
import { DataTable } from '../components/DataTable.jsx'
import { ComparisonHeatmap } from '../components/ComparisonHeatmap.jsx'
import { ShareMenu } from '../components/ShareMenu.jsx'
import { Button } from '../components/Button.jsx'
import { Select } from '../components/Select.jsx'
import { Icon } from '../components/icons.jsx'
import { PageLoading, PageError, StaleBanner } from './pageStates.jsx'

function deltaValue(a, b) {
  return typeof a === 'number' && typeof b === 'number' ? a - b : null
}

export function ComparePage({ pair }) {
  const { status, data, error, stale, generatedAt } = useProjection()
  const navigate = useNavigate()
  const [pickA, setPickA] = useState('')
  const [pickB, setPickB] = useState('')

  const parsed = useMemo(() => {
    if (!pair) return null
    const parts = pair.split('-vs-')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return { invalid: true }
    return { a: parts[0], b: parts[1] }
  }, [pair])

  const resolve = (slug) =>
    status === 'ready'
      ? data.models.find((m) => slugForModel(m) === slug || m.id === slug) ?? null
      : undefined

  const modelA = parsed && !parsed.invalid ? resolve(parsed.a) : undefined
  const modelB = parsed && !parsed.invalid ? resolve(parsed.b) : undefined

  const titleA = modelA?.name ?? parsed?.a
  const titleB = modelB?.name ?? parsed?.b

  useSeo({
    title:
      parsed && modelA && modelB
        ? `${modelA.name} vs ${modelB.name}`
        : 'Compare models',
    description: parsed && modelA && modelB
      ? `Side-by-side evidence comparison of ${modelA.name} and ${modelB.name} on DHEvals — deltas only where verified data exists.`
      : 'Pick two models to compare their verified DHEvals evidence side by side.',
    path: pair ? `/compare/${pair}` : '/compare',
    jsonLd:
      parsed && modelA && modelB
        ? breadcrumbJsonLd([
            { label: 'Compare', to: '/compare' },
            { label: `${modelA.name} vs ${modelB.name}` },
          ])
        : undefined,
  })

  // Canonical ordering: alphabetical slugs. /compare/b-vs-a redirects to a-vs-b.
  useEffect(() => {
    if (parsed && !parsed.invalid) {
      const sorted = [parsed.a, parsed.b].sort()
      if (sorted[0] !== parsed.a) {
        navigate(`/compare/${sorted[0]}-vs-${sorted[1]}`, { replace: true })
      }
    }
  }, [parsed, navigate])

  if (status === 'loading') return <PageLoading testid="compare-page" />
  if (status === 'error') return <PageError testid="compare-page" error={error} />

  /* ---- No pair: the picker ---- */
  if (!pair) {
    const options = data.models.map((model) => ({ value: slugForModel(model), label: model.name }))
    const canCompare = pickA && pickB && pickA !== pickB
    return (
      <div className="container section stack stack--6" data-testid="compare-page">
        {stale ? <StaleBanner generatedAt={generatedAt} /> : null}
        <header className="stack reading">
          <p className="eyebrow">Compare</p>
          <h1 className="heading-xl">Side-by-side evidence</h1>
          <p className="body-lg muted">
            Deltas are computed only where both models have verified, comparable data. Where they do
            not, the page says so — it never invents a winner.
          </p>
        </header>
        <div className="compare-picker panel">
          <Select
            label="Model A"
            options={[{ value: '', label: 'Choose a model…' }, ...options]}
            value={pickA}
            onChange={setPickA}
          />
          <Select
            label="Model B"
            options={[{ value: '', label: 'Choose a model…' }, ...options]}
            value={pickB}
            onChange={setPickB}
          />
          <Button
            onClick={() => canCompare && navigate(`/compare/${[pickA, pickB].sort().join('-vs-')}`)}
            disabled={!canCompare}
          >
            Compare
          </Button>
        </div>
        {pickA && pickA === pickB ? (
          <p className="notice notice--amber">
            <Icon name="alert-triangle" /> Choose two different models — a model cannot be compared with itself.
          </p>
        ) : null}
      </div>
    )
  }

  /* ---- Bad pair ---- */
  if (parsed.invalid || (modelA === null || modelB === null)) {
    const missing = parsed.invalid ? pair : [parsed.a, parsed.b].filter((s, i) => !(i === 0 ? modelA : modelB)).join(', ')
    return (
      <div className="container section" data-testid="compare-page">
        <EmptyState
          title={`“${missing}” cannot be compared.`}
          body="One or both slugs are not in the public projection. Pick from the tracked models instead."
          action={<Button to="/compare">Open the model picker</Button>}
        />
      </div>
    )
  }

  // Re-resolve in canonical order (redirect effect above will fix the URL).
  const canonical = [parsed.a, parsed.b].sort()
  const A = resolve(canonical[0])
  const B = resolve(canonical[1])

  const comparable =
    typeof A.quality_score === 'number' && typeof B.quality_score === 'number'

  const currentSuite = data.suites.find((suite) => suite.current_public)
  const heatmapRows = (currentSuite?.categories ?? []).map((category) => ({
    category,
    a: null,
    b: null,
    state: 'missing',
  }))

  const metricRows = [
    { label: 'Quality /100', a: A.quality_score, b: B.quality_score, unit: '' },
    { label: 'Coverage', a: A.evidence_coverage, b: B.evidence_coverage, unit: '' },
    { label: 'Latency (ms)', a: A.metrics?.latency_ms, b: B.metrics?.latency_ms, unit: ' ms' },
    { label: 'Cost in $/1k', a: A.metrics?.input_cost_per_1k, b: B.metrics?.input_cost_per_1k, unit: '' },
    { label: 'Cost out $/1k', a: A.metrics?.output_cost_per_1k, b: B.metrics?.output_cost_per_1k, unit: '' },
    { label: 'Throughput (tok/s)', a: A.metrics?.tokens_per_second, b: B.metrics?.tokens_per_second, unit: '' },
    { label: 'Context (tokens)', a: A.metrics?.context_tokens, b: B.metrics?.context_tokens, unit: '' },
  ]

  return (
    <div className="container section stack stack--8" data-testid="compare-page">
      {stale ? <StaleBanner generatedAt={generatedAt} /> : null}

      <Breadcrumbs items={[{ label: 'Compare', to: '/compare' }, { label: `${titleA} vs ${titleB}` }]} />

      <header className="stack">
        <p className="eyebrow">Comparison</p>
        <h1 className="heading-xl">
          {A.name} <span className="faint">vs</span> {B.name}
        </h1>
      </header>

      <div className="compare-identity">
        {[A, B].map((model) => (
          <div className="compare-identity__block" key={model.id}>
            <p className="heading-lg">{model.name}</p>
            <p className="mono muted">{model.provider}</p>
            <div className="row">
              <EvidenceBadge state={model.evidence_status} size="md" />
              <span className="badge">License: {model.license ?? '—'}</span>
            </div>
            <p className="micro muted">{model.notes}</p>
          </div>
        ))}
      </div>

      {!comparable ? (
        <p className="notice notice--amber" role="status">
          <Icon name="alert-triangle" />
          <span>
            These models cannot be compared yet — no promoted, verified scores exist in a shared
            suite scope. Every delta below is “—”. Nothing here implies a winner.
          </span>
        </p>
      ) : null}

      <section className="stack" aria-label="Decision summary">
        <p className="eyebrow">Decision summary</p>
        <div className="decision-grid">
          <div className="lead-list">
            <p className="label">Where {A.name} leads</p>
            <p className="micro faint">No verified lead.</p>
          </div>
          <div className="lead-list">
            <p className="label">Where {B.name} leads</p>
            <p className="micro faint">No verified lead.</p>
          </div>
          <div className="lead-list">
            <p className="label">Not comparable</p>
            <ul className="stack stack--2">
              {metricRows.map((row) => (
                <li key={row.label} className="micro muted">{row.label}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="stack" aria-label="Metric deltas">
        <p className="eyebrow">Metric deltas</p>
        <DataTable
          caption={`Metric deltas, ${A.name} minus ${B.name}. Deltas require verified values on both sides.`}
          columns={[
            { key: 'label', label: 'Metric' },
            {
              key: 'a',
              label: A.name,
              numeric: true,
              render: (row) => (typeof row.a === 'number' ? formatScore(row.a) : null),
            },
            {
              key: 'b',
              label: B.name,
              numeric: true,
              render: (row) => (typeof row.b === 'number' ? formatScore(row.b) : null),
            },
            {
              key: 'delta',
              label: 'Δ A − B',
              numeric: true,
              render: (row) => <Delta value={deltaValue(row.a, row.b)} unit={row.unit} />,
            },
          ]}
          rows={metricRows}
          rowKey={(row) => row.label}
        />
      </section>

      <section className="stack" aria-label="Category comparison">
        <p className="eyebrow">Category comparison</p>
        <ComparisonHeatmap
          models={[{ name: A.name }, { name: B.name }]}
          rows={heatmapRows}
          caption={`Category deltas across ${currentSuite?.title} v${currentSuite?.version}. All cells missing — no comparable scores exist.`}
        />
      </section>

      <section className="stack" aria-label="Task-level comparison">
        <p className="eyebrow">Task-level comparison</p>
        <EmptyState
          title="No comparable tasks yet."
          body="Task-level comparison requires promoted runs from both models in the same suite version. Neither model has one."
        />
      </section>

      <section className="panel stack" aria-label="Evidence scope">
        <p className="eyebrow">Evidence scope</p>
        <p className="verification-line">
          Suite {currentSuite?.title} v{currentSuite?.version} · verified {formatDate(generatedAt)}
        </p>
        <p className="micro muted">
          {A.name}: coverage {typeof A.evidence_coverage === 'number' ? `${Math.round(A.evidence_coverage * 100)}%` : '—'} · last verified {formatDate(A.last_verified_at)}.
          {' '}{B.name}: coverage {typeof B.evidence_coverage === 'number' ? `${Math.round(B.evidence_coverage * 100)}%` : '—'} · last verified {formatDate(B.last_verified_at)}.
        </p>
        <div className="row">
          <ShareMenu
            xText={`${A.name} vs ${B.name} on DHEvals — not comparable yet: no promoted, verified scores in a shared suite scope.`}
            cardHref="/brand/social/social-comparison.svg"
          />
          <Button to="/compare" variant="quiet" size="sm">Pick different models</Button>
        </div>
      </section>
    </div>
  )
}

export default ComparePage
