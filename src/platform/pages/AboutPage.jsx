import { useProjection } from '../data.js'
import { useSeo } from '../seo.js'
import { Link } from '../router.jsx'
import { Icon } from '../components/icons.jsx'
import { PageLoading, PageError } from './pageStates.jsx'

const STEPS = [
  { title: 'Choose a suite', text: 'A versioned, hash-pinned task suite defines the scope.' },
  { title: 'Run the model', text: 'Every task is executed and recorded — output, latency, tokens.' },
  { title: 'Verify the evidence', text: 'Deterministic checks score tasks; runs are re-verified.' },
  { title: 'Publish the result', text: 'Calibration and human review gate every promotion.' },
]

export function AboutPage() {
  useSeo({
    title: 'About',
    description:
      'DHEvals is an independent AI model evaluation laboratory: static-first public projection, honest missing data, and a closed release gate by default.',
    path: '/about',
  })
  const { status, error } = useProjection()

  if (status === 'loading') return <PageLoading testid="about-page" />
  if (status === 'error') return <PageError testid="about-page" error={error} />

  return (
    <div className="container section stack stack--8" data-testid="about-page">
      <header className="stack reading">
        <p className="eyebrow">About</p>
        <h1 className="heading-xl">An evaluation lab that publishes its receipts</h1>
        <p className="body-lg muted">
          DHEvals exists so that a claim about an AI model can be checked, not just read. The lab
          runs versioned Brazilian-Portuguese task suites, records the evidence, and publishes it
          with provenance — or publishes the honest archive-only / “not yet” state instead.
        </p>
      </header>

      <div className="prose">
        <h2 id="mission">Mission</h2>
        <p>
          Show how AI models behave when the work is real, multi-step, and worth checking — and make
          the evidence as easy to inspect as the claim. Missing data is shown as “—”, never zero;
          fixtures are labeled, never promoted; and no score is promoted before the release gate passes.
        </p>

        <h2 id="context">Project context</h2>
        <p>
          DHEvals is an independent evaluation laboratory. This site is a static-first public
          projection: what you see is generated from the evidence store ahead of time — there is no
          live inference behind these pages, and nothing changes without a new projection build.
        </p>

        <h2 id="how">How it works</h2>
      </div>

      <ol className="steps">
        {STEPS.map((step, index) => (
          <li className="steps__step" key={step.title}>
            <span className="steps__num">{String(index + 1).padStart(2, '0')}</span>
            <span className="steps__title">{step.title}</span>
            <span className="steps__text">{step.text}</span>
          </li>
        ))}
      </ol>

      <div className="prose">
        <p>
          The full contract is in the <Link to="/methodology">methodology</Link>.
        </p>

        <h2 id="contribute">Repository and contributions</h2>
        <p>
          Suites, methodology, and the projection tooling are versioned in the public repository.
          Found a scoring bug, a bad check, or a task that does not measure what it claims? Open an
          issue:
        </p>
        <p className="row">
          <a href="https://github.com/domlabsai/dhevals" target="_blank" rel="noopener noreferrer" className="btn btn--secondary">
            <Icon name="external" /> github.com/domlabsai/dhevals
          </a>
          <a href="#" aria-label="X (coming soon)" className="btn btn--quiet">X</a>
          <a href="#" aria-label="LinkedIn (coming soon)" className="btn btn--quiet">LinkedIn</a>
        </p>
      </div>
    </div>
  )
}

export default AboutPage
