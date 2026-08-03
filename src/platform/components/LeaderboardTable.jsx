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
}

/*
 * LeaderboardTable — the not-yet-ranked model table. Desktop renders the
 * full metric set as a semantic table; <768px renders compact rows with a
 * "Details" drawer holding the operational metrics. Every missing metric is
 * "—" — absence is a state, never a zero.
 *
 * entries: leaderboard not_ranked rows joined with models.json:
 *   { slug, model_name, provider, reason, evidence_status, model }
 */
export function LeaderboardTable({ entries = [], onOpenModel, className = '', ...rest }) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [detail, setDetail] = useState(null)

  const latencyNote = entries.some((entry) => entry.model?.metrics?.observed_from_runs)
    ? '¹ Observed from archive runs — context only, not a promoted measurement.'
    : undefined

  const columns = [
    { key: 'rank', label: 'Rank', numeric: true, render: () => null },
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
    { key: 'category', label: 'Category score', numeric: true, render: () => null },
    {
      key: 'cost',
      label: 'Cost',
      unit: '$/1k tok',
      numeric: true,
      render: (entry) =>
        typeof entry.model?.metrics?.input_cost_per_1k === 'number' ? entry.model.metrics.input_cost_per_1k : null,
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
      label: 'Last verified',
      render: (entry) =>
        entry.model?.last_verified_at ? <FreshnessLabel at={entry.model.last_verified_at} prefix="" /> : null,
    },
  ]

  if (isMobile) {
    return (
      <div className={className} data-testid="leaderboard-table" {...rest}>
        <ul className="lboard-mobile" aria-label="Models not yet ranked">
          {entries.map((entry) => (
            <li key={entry.model_id} className="lboard-mobile__row">
              <button type="button" className="lboard-mobile__main" onClick={() => onOpenModel?.(entry.slug)}>
                <span className="stack stack--2" style={{ gap: 2 }}>
                  <span>{entry.model_name}</span>
                  <span className="mono micro faint">{entry.provider}</span>
                </span>
                <span className="row" style={{ gap: 'var(--space-2)' }}>
                  <EvidenceBadge state={entry.evidence_status} />
                  <span className="mono num">—</span>
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
                <div><dt>Category score</dt><dd className="mono">—</dd></div>
                <div><dt>Cost $/1k tok</dt><dd className="mono">—</dd></div>
                <div>
                  <dt>Latency</dt>
                  <dd className="mono">
                    {typeof detail.model?.metrics?.latency_ms === 'number'
                      ? `${formatMs(detail.model.metrics.latency_ms)}${detail.model.metrics.observed_from_runs ? ' ¹' : ''}`
                      : '—'}
                  </dd>
                </div>
                <div><dt>Context tokens</dt><dd className="mono">—</dd></div>
                <div>
                  <dt>Last verified</dt>
                  <dd className="mono micro">{detail.model?.last_verified_at ? formatDate(detail.model.last_verified_at) : '—'}</dd>
                </div>
              </dl>
              {latencyNote ? <p className="micro faint">{latencyNote}</p> : null}
            </div>
          ) : null}
        </Drawer>
      </div>
    )
  }

  return (
    <DataTable
      className={className}
      caption="Models under evaluation that do not meet ranking criteria yet — every missing metric is shown as —, never zero."
      columns={columns}
      rows={entries}
      rowKey={(entry) => entry.model_id}
      onRowClick={onOpenModel ? (entry) => onOpenModel(entry.slug) : undefined}
      rowAriaLabel={(entry) => `Open ${entry.model_name}`}
      footnote={latencyNote}
      data-testid="leaderboard-table"
      {...rest}
    />
  )
}

export default LeaderboardTable
