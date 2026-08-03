import { useProjection, RUN_STATUS } from '../data.js'
import { useSeo } from '../seo.js'
import { Link } from '../router.jsx'
import { HeroClaim } from '../components/HeroClaim.jsx'
import { FeaturedResult } from '../components/FeaturedResult.jsx'
import { DecisionCard } from '../components/DecisionCard.jsx'
import { MethodologyCallout } from '../components/MethodologyCallout.jsx'
import { VerificationLine } from '../components/VerificationLine.jsx'
import { EvidenceBadge } from '../components/EvidenceBadge.jsx'
import { FreshnessLabel } from '../components/FreshnessLabel.jsx'
import { CoverageMeter } from '../components/CoverageMeter.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { Button } from '../components/Button.jsx'
import { Icon } from '../components/icons.jsx'
import { PageLoading, PageError, StaleBanner } from './pageStates.jsx'

const STEPS = [
  { title: 'Choose a suite', text: 'A versioned, hash-pinned task suite defines the scope of every claim.' },
  { title: 'Run the model', text: 'The runner executes every task and records outputs, latency, and tokens.' },
  { title: 'Verify the evidence', text: 'Deterministic checks score each task; the run is re-verified end to end.' },
  { title: 'Publish the result', text: 'Only after calibration and human review does a score reach the leaderboard.' },
]

const NOT_CLAIMED = [
  'No universal “smartest model” verdicts — scores are bound to one suite, one locale, one date.',
  'No cost-quality blending — quality and operational metrics are reported separately.',
  'No fixture scores — development fixtures are shown for transparency and are never promoted.',
]

export function HomePage() {
  useSeo({
    title: 'DHEvals — AI model evaluation laboratory',
    description:
      'Public benchmark evidence for AI models: versioned suites, verified runs, and honest reports with provenance attached to every score.',
    path: '/',
  })
  const { status, data, error, stale, generatedAt } = useProjection()

  if (status === 'loading') return <PageLoading testid="home-page" height={320} />
  if (status === 'error') return <PageError testid="home-page" error={error} />

  const overview = data.overview
  const signal = overview.latest_signal
  const calibration = overview.calibration
  const currentSuite = data.suites.find((suite) => suite.current_public) ?? data.suites[0]
  const recentRuns = [...(data.runs.entries ?? [])]
    .sort((a, b) => Date.parse(b.started_at ?? 0) - Date.parse(a.started_at ?? 0))
    .slice(0, 3)

  return (
    <div data-testid="home-page">
      {stale ? <div className="container" style={{ paddingTop: 'var(--space-4)' }}><StaleBanner generatedAt={generatedAt} /></div> : null}

      <div className="container">
        <HeroClaim
          eyebrow="AI model evaluation laboratory"
          headline="See how AI models behave when the work is real, multi-step, and worth checking."
          support="DHEvals runs versioned Brazilian-Portuguese task suites against AI models and publishes the evidence — coverage, checks, provenance — not just numbers. Nothing is promoted until the release gate passes."
          primary={{ to: '/leaderboard', label: 'Explore leaderboard' }}
          secondary={{ to: '/methodology', label: 'Read methodology' }}
          evidence={
            <VerificationLine
              suiteVersion={currentSuite?.version}
              revision={overview.source_revision}
              verifiedAt={overview.generated_at}
            />
          }
        />
      </div>

      <div className="band">
        <div className="container section--tight section home-split">
          <FeaturedResult
            signal={signal}
            revision={overview.source_revision}
            caveat={signal?.is_fixture
              ? 'Offline calibration fixture — not a public model score. It exercises the pipeline and stays out of the leaderboard.'
              : 'Archive-only model evidence — verified for transparency, not promoted to the leaderboard.'}
            action={signal ? { to: `/reports/${signal.run_id}`, label: 'Inspect this run' } : undefined}
          />
          <section className="panel stack" aria-label="Latest verified signal">
            <p className="eyebrow">Latest verified signal</p>
            {overview.counts.promoted_runs === 0 ? (
              <EmptyState
                title="No promoted results yet."
                body="The release gate requires calibration, verification, and human review. Until it opens, this band stays empty — an empty board is the honest state, not a missing feature."
                action={<Button to="/methodology" variant="secondary" size="sm">How the release gate works</Button>}
              />
            ) : null}
          </section>
        </div>
      </div>

      <div className="container section stack stack--6">
        <section className="stack" aria-label="Decisions this lab supports">
          <p className="eyebrow">Decisions this lab supports</p>
          <div className="decision-grid">
            <DecisionCard
              title="Highest verified overall"
              available={false}
              qualification="No promoted, verified score exists yet."
              to="/methodology"
              linkLabel="Why scores stay locked"
            />
            <DecisionCard
              title="Strongest for a workload"
              available={false}
              qualification="Category-level leads require promoted runs in a shared suite scope."
              to="/methodology"
              linkLabel="Why scores stay locked"
            />
            <DecisionCard
              title="Best value"
              available={false}
              qualification="Value claims need measured cost and promoted quality side by side — neither exists yet."
              to="/methodology"
              linkLabel="Why scores stay locked"
            />
          </div>
        </section>

        <section className="stack" aria-label="Browse by workload">
          <p className="eyebrow">Browse by workload</p>
          <div className="category-strip">
            {(currentSuite?.categories ?? []).map((category) => (
              <Link key={category} to={`/leaderboard?category=${encodeURIComponent(category)}`}>
                {category}
              </Link>
            ))}
          </div>
          <p className="micro faint">
            Workload families from {currentSuite?.title} v{currentSuite?.version} — the current public suite.
          </p>
        </section>
      </div>

      <div className="band">
        <div className="container section--tight section stack">
          <p className="eyebrow">How DHEvals works</p>
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li className="steps__step" key={step.title}>
                <span className="steps__num">{String(index + 1).padStart(2, '0')}</span>
                <span className="steps__title">{step.title}</span>
                <span className="steps__text">{step.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="container section stack stack--6">
        <section className="stack" aria-label="Recent reports">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <p className="eyebrow">Recent reports</p>
            <span className="row" style={{ gap: 'var(--space-4)' }}>
              <Link to="/reports/inauguration" className="label">Inauguration report →</Link>
              <Link to="/reports" className="label">All reports →</Link>
            </span>
          </div>
          <div>
            {recentRuns.map((run) => {
              const statusMeta = RUN_STATUS[run.run_status] ?? { label: run.run_status, color: 'cyan' }
              const publishable = !run.is_fixture && run.run_status !== 'locked' && run.run_status !== 'invalid'
              return (
                <Link to={`/reports/${run.id}`} className="report-row" key={run.id}>
                  <span className="report-row__model">
                    <span>{run.model_name}</span>
                    <span className="mono micro faint">
                      {run.suite_id} v{run.suite_version}
                    </span>
                  </span>
                  <span className="report-row__score">
                    {publishable && typeof run.quality_score === 'number' ? `${run.quality_score.toFixed(1)}/100` : '—'}
                  </span>
                  <span className="badge badge--amber">{statusMeta.label}</span>
                  {run.is_fixture ? <span className="badge">Fixture</span> : <span />}
                  <FreshnessLabel at={run.started_at} prefix="Run" />
                </Link>
              )
            })}
          </div>
          <p className="micro faint">
            Archive-only and fixture runs appear here for transparency; they are never presented as promoted results.
          </p>
        </section>

        <section className="calibration-band" aria-label="Calibration status">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <p className="eyebrow">Calibration status</p>
            <span className="badge badge--amber">
              <Icon name="clock" size={12} /> In progress
            </span>
          </div>
          <CoverageMeter
            coverage={calibration.required_groups ? calibration.completed_groups / calibration.required_groups : 0}
            completed={calibration.completed_groups}
            total={calibration.required_groups}
            unitLabel="anchor groups"
          />
          <p className="micro muted">
            {calibration.completed_groups} of {calibration.required_groups} anchor groups reviewed for{' '}
            {currentSuite?.title} v{currentSuite?.version}. Promotion stays closed until calibration completes.{' '}
            <Link to={`/benchmarks/${currentSuite?.slug}`}>See the suite →</Link>
          </p>
        </section>

        <MethodologyCallout />

        <section className="panel stack" aria-label="What DHEvals does not claim">
          <p className="eyebrow">What DHEvals does not claim</p>
          <ul className="stack stack--2">
            {NOT_CLAIMED.map((item) => (
              <li key={item} className="muted body-lg" style={{ fontSize: 'var(--text-body-size)' }}>
                {item}
              </li>
            ))}
          </ul>
          <Link to="/methodology" className="label">
            Full methodology and limitations →
          </Link>
        </section>
      </div>
    </div>
  )
}

export default HomePage
