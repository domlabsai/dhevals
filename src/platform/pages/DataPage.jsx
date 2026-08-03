import { useProjection, formatDate } from '../data.js'
import { useSeo, datasetJsonLd } from '../seo.js'
import { DataTable } from '../components/DataTable.jsx'
import { Icon } from '../components/icons.jsx'
import { PageLoading, PageError, StaleBanner } from './pageStates.jsx'

const SCHEMA = [
  {
    name: 'models.json — model contract',
    fields: [
      ['id / slug', 'Stable identifier and URL slug (slug is used in /models/<slug>).'],
      ['name / provider', 'Display name and serving provider.'],
      ['quality_score', 'Promoted public score (0–100) or null when nothing is promoted.'],
      ['evidence_status', 'supported | estimated | pending | locked | invalid.'],
      ['evidence_coverage', 'Best verified coverage (0–1), or null.'],
      ['metrics', 'input_cost_per_1k, output_cost_per_1k, latency_ms, tokens_per_second, context_tokens — null unless measured; observed_from_runs marks archive-derived values.'],
      ['last_verified_at', 'ISO date of the last verification, or null.'],
      ['sources / notes / license', 'Evidence source paths, plain-language caveat, and license string.'],
    ],
  },
  {
    name: 'suites.json — suite contract',
    fields: [
      ['id / version / slug', 'Suite family, semver version, and URL slug.'],
      ['task_count / categories / dimension_count', 'Scope of the suite: tasks, workload families, scoring dimensions.'],
      ['manifest_hash', 'sha256 of the task manifest — the reproducibility pin.'],
      ['status', 'fixture_only | calibration_pending | calibrated.'],
      ['calibration', 'completed_groups / required_groups of human anchor review.'],
      ['current_public', 'Marks the version scores are framed against.'],
    ],
  },
  {
    name: 'runs.json + runs/<id>.json — run contract',
    fields: [
      ['run_status', 'promoted | verified | archive_only | locked | invalid.'],
      ['quality_score / coverage', 'Suite score (0–100, null unless publishable) and scored-task fraction (0–1).'],
      ['is_fixture / archive_only / lock_reason', 'Transparency flags: fixtures and archive runs are never promoted.'],
      ['summary', 'task_count, completed_count, coverage, overall_score, error_count, estimated_cost_usd_total.'],
      ['categories / tasks', 'Per-category and per-task breakdown with checks, latency, tokens, failure_reason.'],
      ['verification / provenance', 'Re-verification result; manifest hash, runner version, source report.'],
    ],
  },
]

export function DataPage() {
  useSeo({
    title: 'Data downloads',
    description:
      'The full DHEvals public projection as static files: overview, models, suites, runs, leaderboard, catalogs, and per-run evidence JSON.',
    path: '/data',
    jsonLd: datasetJsonLd({
      name: 'DHEvals public data projection',
      description: 'Static public projection of the DHEvals evidence store: models, suites, runs, and leaderboard.',
      path: '/data',
    }),
  })
  const { status, data, error, stale, generatedAt } = useProjection()

  if (status === 'loading') return <PageLoading testid="data-page" />
  if (status === 'error') return <PageError testid="data-page" error={error} />

  const runEntries = data.runs.entries ?? []
  const generated = formatDate(data.overview.generated_at)

  const artifacts = [
    { name: 'overview.json', href: '/data/public/overview.json', kind: 'JSON', note: 'Latest signal, calibration status, counts' },
    { name: 'models.json', href: '/data/public/models.json', kind: 'JSON', note: 'All tracked models' },
    { name: 'suites.json', href: '/data/public/suites.json', kind: 'JSON', note: 'All suite versions' },
    { name: 'runs.json', href: '/data/public/runs.json', kind: 'JSON', note: 'Run index' },
    { name: 'leaderboard.json', href: '/data/public/leaderboard.json', kind: 'JSON', note: 'Ranked + not-ranked models' },
    { name: 'inauguration.json', href: '/data/public/inauguration.json', kind: 'JSON', note: 'Three-stage inauguration report' },
    { name: 'catalog.csv', href: '/data/public/catalog.csv', kind: 'CSV', note: 'Flat run catalog' },
    ...runEntries.map((run) => ({
      name: `runs/${run.id}.json`,
      href: run.artifacts?.json ?? `/data/public/runs/${run.id}.json`,
      kind: 'JSON',
      note: `Run evidence · ${run.model_name} · v${run.suite_version}${run.is_fixture ? ' · fixture' : ''}`,
    })),
    { name: 'latest-report.html', href: '/data/latest-report.html', kind: 'HTML', note: 'Latest report as a standalone page' },
    { name: 'latest-results.csv', href: '/data/latest-results.csv', kind: 'CSV', note: 'Latest results as flat rows' },
  ]

  return (
    <div className="container section stack stack--8" data-testid="data-page">
      {stale ? <StaleBanner generatedAt={generatedAt} /> : null}

      <header className="stack reading">
        <p className="eyebrow">Data</p>
        <h1 className="heading-xl">Download the projection</h1>
        <p className="body-lg muted">
          Everything this site shows is derived from these static files. Take them, recompute them,
          check them. Sizes are not listed — fetch the file; your client will tell you.
        </p>
      </header>

      <section className="stack" aria-label="Artifacts">
        <DataTable
          caption="Public projection artifacts. All files are static and safe to mirror."
          columns={[
            {
              key: 'name',
              label: 'Artifact',
              render: (row) => (
                <a href={row.href} download className="mono micro" style={{ color: 'var(--color-cobalt)' }}>
                  <Icon name="download" size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
                  {row.name}
                </a>
              ),
            },
            { key: 'kind', label: 'Kind', render: (row) => <span className="badge">{row.kind}</span> },
            { key: 'size', label: 'Size', render: () => null },
            { key: 'generated', label: 'Generated', render: () => generated },
            { key: 'note', label: 'Contents', render: (row) => <span className="micro muted">{row.note}</span> },
          ]}
          rows={artifacts}
          rowKey={(row) => row.name}
        />
        <p className="micro faint">
          Brand assets (logos, social cards) live under <code className="mono">/brand/</code> — see{' '}
          <code className="mono">/brand/social/</code> for the 1200×630 cards.
        </p>
      </section>

      <section className="stack" aria-label="Schema">
        <p className="eyebrow">Schema notes</p>
        <p className="muted" style={{ maxWidth: '72ch' }}>
          The projection follows three contracts. Missing values are JSON null and render as “—” on
          the site — never zero.
        </p>
        <div className="decision-grid">
          {SCHEMA.map((block) => (
            <div className="schema-block" key={block.name}>
              <p className="label">{block.name}</p>
              <dl>
                {block.fields.map(([field, text]) => (
                  <div key={field}>
                    <dt>{field}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default DataPage
