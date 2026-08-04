import { useProjection, EVIDENCE_STATES } from '../data.js'
import { useSeo, breadcrumbJsonLd } from '../seo.js'
import { MethodologyCallout } from '../components/MethodologyCallout.jsx'
import { Timeline } from '../components/Timeline.jsx'
import { EvidenceBadge } from '../components/EvidenceBadge.jsx'
import { PageLoading, PageError } from './pageStates.jsx'

const TASK_FAMILIES = [
  'Research synthesis',
  'Document QA',
  'Planning',
  'Data analysis',
  'Code',
  'Communication',
  'Long context',
  'Structured output',
  'Safe automation',
  'Critical review',
]

const SECTIONS = [
  ['what', 'What DHEvals measures'],
  ['what-not', 'What it does not measure'],
  ['score', 'Deterministic score'],
  ['coverage', 'Coverage'],
  ['evidence-states', 'Evidence states'],
  ['calibration', 'Calibration gate'],
  ['missing-data', 'Missing data'],
  ['failures', 'Timeouts and failures'],
  ['quality-cost', 'Quality vs cost'],
  ['reproducibility', 'Reproducibility'],
  ['limitations', 'Limitations'],
  ['history', 'Methodology version history'],
]

export function MethodologyPage() {
  const { status, data, error } = useProjection()
  const methodologyVersion = status === 'ready' ? data.overview.methodology_version : '0.1.0'

  useSeo({
    title: 'Methodology',
    description:
      'How DHEvals scores AI models: deterministic checks, coverage, evidence states, the calibration gate, and what the numbers do not claim.',
    path: '/methodology',
    jsonLd: breadcrumbJsonLd([{ label: 'Methodology' }]),
  })

  if (status === 'loading') return <PageLoading testid="methodology-page" />
  if (status === 'error') return <PageError testid="methodology-page" error={error} />

  return (
    <div className="container section stack stack--8" data-testid="methodology-page">
      <header className="stack reading">
        <p className="eyebrow">Methodology · v{methodologyVersion}</p>
        <h1 className="heading-xl">How a DHEvals number is made</h1>
        <p className="body-lg muted">
          Every figure on this site is produced the same way: a versioned suite, a recorded run,
          deterministic checks, and a release gate. This page is the contract behind the numbers.
        </p>
      </header>

      <MethodologyCallout>
        If you read one thing: a DHEvals score is valid only inside its scope — one suite version,
        one locale, one date, one coverage figure. Outside that scope, the honest answer is “—”.
      </MethodologyCallout>

      <nav className="category-strip" aria-label="On this page">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`}>{label}</a>
        ))}
      </nav>

      <div className="prose">
        <h2 id="what">What DHEvals measures</h2>
        <p>
          DHEvals measures how AI models behave on heavy-user work in Brazilian Portuguese: real,
          multi-step tasks where the output is worth checking. The current public suite family covers
          ten task families:
        </p>
        <ul>
          {TASK_FAMILIES.map((family) => (
            <li key={family}>{family}</li>
          ))}
        </ul>
        <p>
          Each task is a composed brief — the kind a demanding professional would actually send — with
          explicit, checkable requirements.
        </p>

        <h2 id="what-not">What it does not measure</h2>
        <ul>
          <li>No universal intelligence claims. A score says how a model did on this suite, in pt-BR, on this date — nothing more.</li>
          <li>No cost-quality blending. Quality and operational metrics are reported side by side, never merged into one “value” number.</li>
          <li>No fixture scores. Development fixtures exercise the pipeline; they are labeled and never published as model performance.</li>
          <li>No cross-version comparisons. Suite v0.1.0 and v0.2.0 are different scopes; scores across them are not comparable.</li>
        </ul>

        <h2 id="score">Deterministic score</h2>
        <p>
          Scoring is deterministic — no model judges another model. Each task carries explicit checks
          (required phrases, minimum length, JSON structure, forbidden content). A task score is the
          mean of its checks; the suite score is the mean of scored tasks, scaled to 0–100:
        </p>
        <code className="formula">suite_score = Σ task_score / scored_tasks × 100</code>
        <p>
          Coverage is always reported next to the score. A 90 with 60% coverage is a weaker statement
          than an 85 with 100% coverage, and the site never hides which one you are looking at.
        </p>

        <h2 id="coverage">Coverage</h2>
        <p>
          Coverage is the fraction of suite tasks that produced a valid score: scored tasks ÷ total
          tasks, from 0 to 1. Ranking requires full coverage (1.0). Verified full-coverage archive
          runs may appear in the observed comparative ranking; partial-coverage results may exist in
          the archive, but they cannot be ranked or promoted.
        </p>

        <h2 id="evidence-states">Evidence states</h2>
        <p>Every number carries one of five evidence states. The state decides how the number may be used:</p>
        <div className="table-wrap">
          <table className="table">
            <caption>Evidence states and how they affect ranking</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Meaning</th>
                <th scope="col">Ranking behavior</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(EVIDENCE_STATES).map(([key, meta]) => (
                <tr key={key}>
                  <td><EvidenceBadge state={key} /></td>
                  <td className="muted">{meta.description}</td>
                  <td className="micro muted">
                    {key === 'supported'
                      ? 'Eligible for the leaderboard.'
                      : key === 'estimated'
                        ? 'Shown with amber treatment; never ranked.'
                        : 'Excluded from ranking; shown as —.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="calibration">Calibration gate</h2>
        <p>
          Before any score can be promoted, the suite must be calibrated: human reviewers grade a set
          of anchor groups ({data.overview.calibration.required_groups} for suite v0.2.0, 300 for
          v0.3.0) so the deterministic checks are proven to line up with human judgment. Completed so
          far: {data.overview.calibration.completed_groups}. Until the gate passes and a run clears
          verification plus human review, scores remain locked as promoted claims. Verified archive-only
          scores can still appear in the observed ranking, explicitly labeled and without a
          certification claim.
        </p>

        <h2 id="missing-data">Missing data</h2>
        <p>
          Missing values render as “—”, never as zero. <em>Not evaluated</em> is a state, not a
          result: a model without a run has no score, and a run without a valid task score does not
          contribute to the suite score. Zero means a check genuinely failed; “—” means there is
          nothing to show.
        </p>

        <h2 id="failures">Timeouts and failures</h2>
        <p>
          Runs record an error count and a per-task failure reason. Errored tasks are excluded from
          the scored set — they do not drag the score toward zero — but they do count against
          coverage, so a run with many failures cannot hide behind a high partial score.
        </p>

        <h2 id="quality-cost">Quality vs cost</h2>
        <p>
          Quality (suite score), latency, throughput, and cost are separate axes. DHEvals never
          computes a single “best value” figure, because the right trade-off depends on your workload
          and budget — the site shows the axes and lets you decide.
        </p>

        <h2 id="reproducibility">Reproducibility</h2>
        <p>
          Every run is pinned to a suite manifest hash, a runner version, and a source report — all
          visible on the report page. The suites, the methodology, and the npm scripts that build the
          public projection live in the public repository:{' '}
          <a href="https://github.com/domlabsai/dhevals" rel="noopener noreferrer" target="_blank">
            github.com/domlabsai/dhevals
          </a>
          .
        </p>

        <h2 id="limitations">Limitations</h2>
        <ul>
          <li>Single locale: pt-BR only. Nothing here generalizes to other languages.</li>
          <li>Small task counts (6–20 tasks per suite version); most categories have one task each.</li>
          <li>Calibration is incomplete, so no score is promoted yet; observed archive-only rankings are comparative evidence only.</li>
          <li>Most recorded runs are development fixtures, not real model executions.</li>
          <li>Deterministic checks reward required content; they cannot judge style or deeper correctness beyond the encoded anchors.</li>
        </ul>

        <h2 id="history">Methodology version history</h2>
        <Timeline
          ariaLabel="Methodology versions"
          items={[
            {
              date: data.overview.generated_at,
              color: 'lime',
              label: 'Current',
              title: `v${methodologyVersion}`,
              meta: 'Initial public methodology: deterministic checks, coverage, evidence states, calibration gate.',
            },
          ]}
        />
      </div>
    </div>
  )
}

export default MethodologyPage
