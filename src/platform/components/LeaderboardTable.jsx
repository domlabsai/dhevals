import { useState } from 'react'
import { DataTable } from './DataTable.jsx'
import { Drawer } from './Drawer.jsx'
import { EvidenceBadge } from './EvidenceBadge.jsx'
import { IconButton } from './IconButton.jsx'
import { FreshnessLabel } from './FreshnessLabel.jsx'
import { useMediaQuery } from './useMediaQuery.js'
import { formatScore, formatMs, formatDate } from '../data.js'

const REASON_LABELS = {
  pending: 'Evaluation in progress',
  not_configured: 'Endpoint not configured',
  locked: 'Evidence locked (archive/fixture)',
  archive_only: 'Observed archive-only score',
}

/*
 * LeaderboardTable — the ranked and not-yet-ranked model table. Desktop renders the
 * full metric set as a semantic table; <768px renders compact rows with a
 * "Details" drawer holding the operational metrics. Every missing metric is
 * "—" — absence is a state, never a zero.
 *
 * entries: leaderboard not_ranked rows joined with models.json:
 *   { slug, model_name, provider, reason, evidence_status, model }
 */
export function LeaderboardTable({ entries = [], onOpenModel, mode = 'not_ranked', className = '', ...rest }) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [detail, setDetail] = useState(null)
  const rankedMode = mode === 'ranked'

  const latencyNote = entries.some((entry) => entry.model?.metrics?.observed_from_runs)
    ? '¹ Observed from archive runs — context only, not a promoted measurement.'
    : undefined
  const costEstimateNote = entries.some((entry) => entry.model?.metrics?.cost_is_estimate)
    ? '² Estimated cost: base model-list price × recorded/estimated tokens; final provider billing may differ.'
    : undefined
  const metricFootnote = [latencyNote, costEstimateNote].filter(Boolean).join(' ')

  const columns = [
    { key: 'rank', label: 'Rank', numeric: true, render: (entry) => entry.rank ?? null },
    {
      key: 'model',
      label: 'Model',
      render: (entry) => (
        <span className="stack stack--2" style={{ gap: 2 }}>
          <span>{entry.model_name}</span>
          <span className="mono micro faint">{entry.provider}</span>
        </span>
      ),
    },
    { key: 'evidence', label: 'Evidence', render: (entry) => <EvidenceBadge state={entry.evidence_status} /> },
    { key: 'reason', label: 'Gate status', render: (entry) => <span className="micro muted">{REASON_LABELS[entry.reason] ?? entry.reason}</span> },
    {
      key: 'quality',
      label: 'Quality',
      unit: '/100',
      numeric: true,
      render: (entry) => (typeof entry.model?.quality_score === 'number' ? formatScore(entry.model.quality_score) : null),
    },
    { key: 'category', label: 'Category score', render: (entry) => <CategorySummary scores={entry.model?.category_scores} /> },
    {
      key: 'cost',
      label: 'Cost',
      unit: '$/1k tok',
      numeric: true,
      render: (entry) =>
        typeof entry.model?.metrics?.cost_per_1k === 'number'
          ? `${entry.model.metrics.cost_is_estimate ? '≈' : ''}${entry.model.metrics.cost_per_1k.toFixed(4)}${entry.model.metrics.cost_is_estimate ? ' ²' : ''}`
          : null,
    },
    {
      key: 'latency',
      label: 'Latency',
      numeric: true,
      render: (entry) =>
        typeof entry.model?.metrics?.latency_ms === 'number'
          ? `${formatMs(entry.model.metrics.latency_ms)}${entry.model.metrics.observed_from_runs ? ' ¹' : ''}`
          : null,
    },
    {
      key: 'context',
      label: 'Context',
      unit: 'tok',
      numeric: true,
      render: (entry) => (typeof entry.model?.metrics?.context_tokens === 'number' ? entry.model.metrics.context_tokens.toLocaleString('en-US') : null),
    },
    { key: 'license', label: 'License', render: (entry) => <span className="micro">{entry.model?.license ?? null}</span> },
    {
      key: 'verified',
      label: 'Bench Run Date',
      render: (entry) =>
        entry.model?.bench_run_date ? <FreshnessLabel at={entry.model.bench_run_date} prefix="" /> : null,
    },
  ]

  if (isMobile) {
    return (
      <div className={className} data-testid="leaderboard-table" {...rest}>
          <ul className="lboard-mobile" aria-label={rankedMode ? 'Observed archive-only ranked models' : 'Models not yet ranked'}>
          {entries.map((entry) => (
            <li key={entry.model_id} className="lboard-mobile__row">
              <button type="button" className="lboard-mobile__main" onClick={() => onOpenModel?.(entry.slug)}>
                <span className="stack stack--2" style={{ gap: 2 }}>
                  <span>{entry.model_name}</span>
                  <span className="mono micro faint">{entry.provider}</span>
                </span>
                <span className="row" style={{ gap: 'var(--space-2)' }}>
                  <EvidenceBadge state={entry.evidence_status} />
                  <span className="mono num">{typeof entry.model?.quality_score === 'number' ? formatScore(entry.model.quality_score) : '—'}</span>
                </span>
              </button>
              <IconButton icon="chevron-right" label={`Details for ${entry.model_name}`} onClick={() => setDetail(entry)} />
            </li>
          ))}
        </ul>
        <Drawer open={detail !== null} onClose={() => setDetail(null)} title={detail?.model_name ?? 'Model details'}>
          {detail ? (
            <div className="stack">
              <div className="row">
                <EvidenceBadge state={detail.evidence_status} size="md" />
                <span className="badge">{detail.model?.license ?? '—'}</span>
              </div>
              <p className="micro muted">{REASON_LABELS[detail.reason] ?? detail.reason}</p>
              <dl className="detail-grid">
                <div><dt>Provider</dt><dd className="mono micro">{detail.provider}</dd></div>
                <div><dt>Quality /100</dt><dd className="mono">{typeof detail.model?.quality_score === 'number' ? formatScore(detail.model.quality_score) : '—'}</dd></div>
                <div><dt>Category score</dt><dd><CategorySummary scores={detail.model?.category_scores} expanded /></dd></div>
                <div><dt>Cost $/1k tok</dt><dd className="mono">{typeof detail.model?.metrics?.cost_per_1k === 'number' ? detail.model.metrics.cost_per_1k.toFixed(4) : '—'}</dd></div>
                <div><dt>Run tokens</dt><dd className="mono">{typeof detail.model?.metrics?.tokens_total === 'number' ? detail.model.metrics.tokens_total.toLocaleString('en-US') : '—'}</dd></div>
                <div><dt>Estimated run cost</dt><dd className="mono">{typeof detail.model?.metrics?.run_cost_usd === 'number' ? `${detail.model.metrics.cost_is_estimate ? '≈' : ''}$${detail.model.metrics.run_cost_usd.toFixed(4)}` : '—'}</dd></div>
                <div>
                  <dt>Latency</dt>
                  <dd className="mono">
                    {typeof detail.model?.metrics?.latency_ms === 'number'
                      ? `${formatMs(detail.model.metrics.latency_ms)}${detail.model.metrics.observed_from_runs ? ' ¹' : ''}`
                      : '—'}
                  </dd>
                </div>
                <div><dt>Context tokens</dt><dd className="mono">{typeof detail.model?.metrics?.context_tokens === 'number' ? detail.model.metrics.context_tokens.toLocaleString('en-US') : '—'}</dd></div>
                <div>
                  <dt>Bench Run Date</dt>
                  <dd className="mono micro">{detail.model?.bench_run_date ? formatDate(detail.model.bench_run_date) : '—'}</dd>
                </div>
              </dl>
              {metricFootnote ? <p className="micro faint">{metricFootnote}</p> : null}
              {detail.model?.metrics?.cost_estimate_warning ? <p className="notice notice--amber micro">{detail.model.metrics.cost_estimate_warning}</p> : null}
            </div>
          ) : null}
        </Drawer>
      </div>
    )
  }

  return (
    <div className={className}>
      {costEstimateNote ? <p className="notice notice--amber micro" role="status">{costEstimateNote}</p> : null}
      <DataTable
        caption={rankedMode ? 'Observed archive-only model ranking — scores are verified comparative evidence, not promoted certification.' : 'Models under evaluation that do not meet ranking criteria yet — every missing metric is shown as —, never zero.'}
        columns={columns}
        rows={entries}
        rowKey={(entry) => entry.model_id}
        onRowClick={onOpenModel ? (entry) => onOpenModel(entry.slug) : undefined}
        rowAriaLabel={(entry) => `Open ${entry.model_name}`}
        footnote={metricFootnote}
        data-testid="leaderboard-table"
        {...rest}
      />
    </div>
  )
}

function CategorySummary({ scores, expanded = false }) {
  const items = Object.entries(scores || {})
    .filter(([, value]) => typeof value === 'number')
    .sort(([, left], [, right]) => right - left)
  if (!items.length) return null
  const visible = expanded ? items : items.slice(0, 3)
  return (
    <span className="stack stack--2 micro" title={items.map(([category, score]) => `${category}: ${score.toFixed(1)}`).join(' · ')}>
      {visible.map(([category, score]) => (
        <span key={category} className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <span className="faint">{category}</span>
          <span className="mono">{score.toFixed(1)}</span>
        </span>
      ))}
      {!expanded && items.length > visible.length ? <span className="faint">+{items.length - visible.length} more</span> : null}
    </span>
  )
}

export default LeaderboardTable
