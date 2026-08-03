import { useEffect, useMemo, useState } from 'react'
import CalibrationReviewer from './CalibrationReviewer.jsx'

const categories = [
  { name: 'Research', score: 82.7, baseline: 70.1 },
  { name: 'Documents', score: 75.3, baseline: 64.0 },
  { name: 'Planning', score: 77.8, baseline: 69.2 },
  { name: 'Data', score: 80.1, baseline: 72.3 },
  { name: 'Code', score: 81.6, baseline: 71.4 },
  { name: 'Communication', score: 72.5, baseline: 61.8 },
]

const tasks = [
  {
    id: 'research-synthesis',
    name: 'Research & synthesis',
    category: 'Research',
    score: '82.7',
    latency: '38.6s',
    tokens: '28,451',
    started: '10:14:35 AM',
    status: 'Completed',
    statusType: 'complete',
    percentile: '86th',
    inputTokens: '12,341',
    outputTokens: '16,110',
    sources: 12,
    evidence:
      'The task asked for a comparative analysis of retrieval-augmented generation (RAG) strategies for enterprise search.\n\nSaciLM synthesized findings from 12 high-quality sources (2022–2024), identified consistent themes, and produced a structured summary with trade-offs, recommendations, and citations.\n\nKey points:\n- Hybrid search improves recall by ~18% over dense-only.\n- Re-ranking with cross-encoders yields the largest precision gains.\n- Freshness and grounding remain the top failure modes in production.',
  },
  {
    id: 'document-qa',
    name: 'Document Q&A',
    category: 'Documents',
    score: '75.3',
    latency: '24.1s',
    tokens: '16,982',
    started: '10:18:26 AM',
    status: 'Completed',
    statusType: 'complete',
    percentile: '73rd',
    inputTokens: '7,340',
    outputTokens: '9,642',
    sources: 4,
    evidence:
      'Extracted decisions, owners, dates and unresolved questions from a 42-page operations brief. The output preserved the source section names and flagged two contradictory deadlines for human review.',
  },
  {
    id: 'plan-outline',
    name: 'Plan & outline',
    category: 'Planning',
    score: '77.8',
    latency: '31.2s',
    tokens: '21,307',
    started: '10:21:05 AM',
    status: 'Completed',
    statusType: 'complete',
    percentile: '79th',
    inputTokens: '8,922',
    outputTokens: '12,385',
    sources: 0,
    evidence:
      'Built a launch plan under a fixed budget and a two-week deadline. Dependencies were explicit, and the plan surfaced the one constraint that would put the schedule at risk.',
  },
  {
    id: 'data-analysis',
    name: 'Data analysis',
    category: 'Data',
    score: '80.1',
    latency: '45.7s',
    tokens: '34,112',
    started: '10:24:18 AM',
    status: 'Completed',
    statusType: 'complete',
    percentile: '83rd',
    inputTokens: '14,881',
    outputTokens: '19,231',
    sources: 1,
    evidence:
      'Computed retention and cohort deltas from a synthetic operations dataset, then translated the result into a short decision memo with assumptions and a recommended next experiment.',
  },
  {
    id: 'code-generation',
    name: 'Code generation',
    category: 'Code',
    score: '81.6',
    latency: '52.3s',
    tokens: '39,884',
    started: '10:28:31 AM',
    status: 'Completed',
    statusType: 'complete',
    percentile: '84th',
    inputTokens: '17,160',
    outputTokens: '22,724',
    sources: 0,
    evidence:
      'Diagnosed a failing TypeScript worker, proposed a minimal patch, and added a regression test. The implementation is correct but includes one unnecessary abstraction that affects maintainability.',
  },
  {
    id: 'email-draft',
    name: 'Email draft',
    category: 'Communication',
    score: '—',
    latency: '18.4s',
    tokens: '7,621',
    started: '10:30:12 AM',
    status: 'In progress',
    statusType: 'progress',
    percentile: '—',
    inputTokens: '3,010',
    outputTokens: '4,611',
    sources: 0,
    evidence:
      'The model is drafting a concise update for a cross-functional team. The final score will be available when the tone, constraints and call-to-action checks finish.',
  },
]

const navItems = [
  ['Overview', 'activity'],
  ['Runs', 'runs'],
  ['Models', 'models'],
  ['Tasks', 'tasks'],
  ['Datasets', 'datasets'],
  ['Benchmarks', 'benchmarks'],
  ['Calibration', 'calibration'],
  ['Reports', 'reports'],
  ['Settings', 'settings'],
]

const activity = [
  ['10:38', 'Task completed', 'Code generation'],
  ['10:37', 'Task completed', 'Data analysis'],
  ['10:35', 'Task started', 'Communication'],
  ['10:35', 'Task completed', 'Planning'],
  ['10:33', 'Task completed', 'Document Q&A'],
]

function Glyph({ name, size = 16 }) {
  const paths = {
    activity: <><path d="M3 12h3l2-7 3 11 2-7h4" /><path d="M3 19h18" /></>,
    runs: <><path d="M5 5h14M5 12h14M5 19h14" /><circle cx="3" cy="5" r="1" /><circle cx="3" cy="12" r="1" /><circle cx="3" cy="19" r="1" /></>,
    models: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.3 7.6 7.7 4.6 7.7-4.6M12 12.2V21" /></>,
    tasks: <><path d="M5 4.5h14v15H5z" /><path d="m8.5 9 2 2 4-4M8.5 15h6M8.5 18h4" /></>,
    datasets: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></>,
    benchmarks: <><path d="M4 19h16M6 16V9M10 16V5M14 16v-3M18 16V7" /><path d="m6 7 4-3 4 2 4-4" /></>,
    reports: <><path d="M6 3h9l3 3v15H6z" /><path d="M9 12h6M9 16h6M9 8h3" /></>,
    calibration: <><path d="M5 5h14M5 12h14M5 19h14" /><circle cx="9" cy="5" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="19" r="2" /></>,
    settings: <><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /><circle cx="12" cy="12" r="4" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="1" /><path d="M16 8V5H5v11h3" /></>,
    source: <><circle cx="12" cy="12" r="8" /><path d="M9.5 12h5M12 9.5v5" /></>,
    broadcast: <><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.8 4.8a10 10 0 0 0 0 14.4M19.2 4.8a10 10 0 0 1 0 14.4" /></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function StatusDot({ type = 'complete' }) {
  return <span className={`status-dot ${type}`} aria-hidden="true" />
}

function CategoryChart({ categoryData, activeCategory, onSelect, currentLabel = 'Current model', baselineLabel = 'Baseline' }) {
  const width = 760
  const rowHeight = 43
  const height = Math.max(294, 66 + categoryData.length * rowHeight)
  const chartX = 96
  const chartWidth = 570
  const xFor = (value) => chartX + (value / 100) * chartWidth

  return (
    <div className="chart-frame">
      <div className="chart-axis-labels" aria-hidden="true">
        {[0, 20, 40, 60, 80, 100].map((value) => <span key={value}>{value}</span>)}
      </div>
      <svg className="category-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Comparação de pontuação por categoria entre ${currentLabel} e baseline`}>
        <title>Comparação de pontuação por categoria</title>
        {[0, 20, 40, 60, 80, 100].map((value) => (
          <line key={value} className="chart-grid-line" x1={xFor(value)} y1="16" x2={xFor(value)} y2={height - 16} />
        ))}
        {categoryData.map((category, index) => {
          const y = 36 + index * rowHeight
          const active = category.name === activeCategory
          const currentPoints = `${xFor(8)},${y + 8} ${xFor(Math.max(20, category.score - 60))},${y + 3} ${xFor(Math.max(45, category.score - 39))},${y - 1} ${xFor(category.score)},${y - 7}`
          const baselinePoints = `${xFor(8)},${y + 18} ${xFor(Math.max(18, category.baseline - 48))},${y + 16} ${xFor(Math.max(38, category.baseline - 21))},${y + 14} ${xFor(category.baseline)},${y + 10}`
          return (
            <g key={category.name} className={`chart-row ${active ? 'active' : ''}`} onClick={() => onSelect(category.name)}>
              <line className="chart-row-line" x1={chartX} y1={y + 18} x2={chartX + chartWidth} y2={y + 18} />
              <text className="chart-category-label" x="0" y={y + 5}>{category.name}</text>
              <polyline className="series-current" points={currentPoints} />
              <polyline className="series-baseline" points={baselinePoints} />
              {currentPoints.split(' ').map((point, pointIndex) => {
                const [cx, cy] = point.split(',')
                return <circle key={`c-${pointIndex}`} className="point-current" cx={cx} cy={cy} r={pointIndex === 3 ? 4.5 : 3.5} />
              })}
              {baselinePoints.split(' ').map((point, pointIndex) => {
                const [cx, cy] = point.split(',')
                return <circle key={`b-${pointIndex}`} className="point-baseline" cx={cx} cy={cy} r="3.2" />
              })}
              <text className="chart-value current" x={chartX + chartWidth + 16} y={y - 4}>{category.score.toFixed(1)}</text>
              <text className="chart-value baseline" x={chartX + chartWidth + 16} y={y + 14}>{category.baseline.toFixed(1)}</text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend" aria-label="Legenda do gráfico">
        <span><i className="legend-line current" />{currentLabel} <em>(current run)</em></span>
        <span><i className="legend-line baseline" />{baselineLabel} <em>(comparison)</em></span>
      </div>
    </div>
  )
}

function ActivityRail() {
  return (
    <div className="activity-rail">
      <div className="activity-rail-head"><StatusDot type="live" /><span>Live feed</span><Glyph name="chevron" size={13} /></div>
      <div className="activity-list">
        {activity.map(([time, event, detail]) => (
          <div className="activity-item" key={`${time}-${detail}`}>
            <span className="activity-time">{time}</span>
            <span className="activity-event">{event}</span>
            <span className="activity-detail">{detail}</span>
          </div>
        ))}
      </div>
      <button className="activity-link" type="button">View full log <Glyph name="arrow" size={14} /></button>
    </div>
  )
}

function MetricCard({ label, value, detail }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}

function SecondaryView({ activeNav, runArtifact, reportArtifact, youtubePack, leaderboard, preflight, calibrationArtifact, calibrationExpandedArtifact, calibrationHandoff, verificationArtifact, auditArtifact, releaseGate, sacilmReadiness, goalAudit, suiteCatalog, runCatalog, modelCatalog, testMatrixCatalog, testExecution, datasetCatalog, scorecard, judgeArtifact, experimentCatalog, comparisonExecution, displayTasks, categoryData, onExportRun, onExportYoutube }) {
  const [reviewerMode, setReviewerMode] = useState(false)
  const run = runArtifact?.run ?? {}
  const model = run.model ?? {}
  const modelExtra = model.extra ?? {}
  const summary = reportArtifact?.summary ?? runArtifact?.summary ?? {}
  const calibration = calibrationArtifact ?? {}
  const calibrationReview = calibration.review ?? {}
  const calibrationPercent = typeof calibration.completion_percent === 'number' ? calibration.completion_percent : 0
  const categories = reportArtifact?.categories ?? categoryData.map((category) => ({ ...category, score: category.score / 100 }))
  const scorecardDimensions = scorecard?.dimensions ?? {}
  const scorecardQuality = scorecardDimensions.quality?.score
  const scorecardStatus = scorecard?.publication?.status ?? 'not loaded'
  const judgeDimension = scorecardDimensions.judge_quality ?? {}
  const judgeStatus = judgeDimension.status ?? judgeArtifact?.status ?? 'not evaluated'
  const judgeScore = typeof judgeDimension.score === 'number' ? judgeDimension.score : (typeof judgeArtifact?.score === 'number' ? judgeArtifact.score : null)
  const titleMap = {
    Runs: 'Runs ledger',
    Models: 'Model registry',
    Tasks: 'Task catalog',
    Datasets: 'Dataset & suite registry',
    Benchmarks: 'Benchmark matrix',
    Calibration: 'Human calibration gate',
    Reports: 'Reports & publishing',
    Settings: 'Runtime settings',
  }
  const descriptionMap = {
    Runs: 'Every visible number below is reconstructed from the selected run artifact.',
    Models: 'Proveniência de modelo e runtime registrada junto do score.',
    Tasks: 'A matriz é versionada; esta superfície mostra a execução selecionada.',
    Datasets: 'Hashes e versões tornam a comparação reproduzível antes da publicação.',
    Benchmarks: 'Agregação por categoria sem misturar qualidade, custo e latência.',
    Calibration: 'Review progress and audit trail for the human rubric gate.',
    Reports: 'Artefatos derivados para análise pública e gravação factual.',
    Settings: 'Configuração segura do endpoint; segredos permanecem fora do repositório.',
  }

  return <section className="secondary-view" data-testid={`view-${activeNav.toLowerCase()}`}>
    <div className="secondary-view-head">
      <div><span className="inspector-label">DHEvals public console</span><h2>{titleMap[activeNav] ?? activeNav}</h2><p>{descriptionMap[activeNav] ?? 'DHEvals surface'}</p></div>
      <span className="secondary-status"><StatusDot type="complete" />artifact-backed</span>
    </div>

    {activeNav === 'Runs' && <>
      <div className="metric-cards">
        <MetricCard label="Run ID" value={run.id ?? 'demo-run'} detail={`${run.suite_id ?? 'dhevals'} v${run.suite_version ?? '0.1.0'}`} />
        <MetricCard label="Coverage" value={`${Math.round((summary.coverage ?? 0) * 100)}%`} detail={`${summary.completed_count ?? 0} / ${summary.task_count ?? displayTasks.length} tasks`} />
        <MetricCard label="Quality score" value={typeof summary.overall_score === 'number' ? `${(summary.overall_score * 100).toFixed(1)}` : '—'} detail="deterministic checks" />
      </div>
      <div className="report-panel"><span className="inspector-label">Run provenance</span><dl className="provenance-list"><div><dt>Started</dt><dd>{run.started_at ?? '—'}</dd></div><div><dt>Finished</dt><dd>{run.finished_at ?? '—'}</dd></div><div><dt>Suite hash</dt><dd>{run.suite_hash ?? '—'}</dd></div><div><dt>Runner</dt><dd>{run.runner_version ?? '—'}</dd></div></dl></div>
      <div className="report-panel table-scroll" data-testid="run-history"><span className="inspector-label">Run history</span><table className="report-table"><thead><tr><th>Run</th><th>Model</th><th>Suite</th><th>Coverage</th><th>Score</th><th>Publication</th></tr></thead><tbody>{(runCatalog?.entries ?? []).length ? runCatalog.entries.map((entry) => <tr key={`${entry.run_id}-${entry.suite_hash}`}><th>{entry.run_id}{entry.current_public ? ' · public' : ''}</th><td>{entry.model_id}<br /><small>{entry.provider}</small></td><td>v{entry.suite_version}</td><td>{typeof entry.coverage === 'number' ? `${Math.round(entry.coverage * 100)}%` : '—'}</td><td className="table-score">{typeof entry.score === 'number' ? `${(entry.score * 100).toFixed(1)}` : '—'}</td><td>{entry.publication_status}{entry.lock_reason ? ` · ${entry.lock_reason}` : ''}</td></tr>) : <tr><td colSpan="6">No archived reports yet.</td></tr>}</tbody></table></div>
      <div className="report-panel table-scroll" data-testid="experiment-registry"><div className="leaderboard-head"><div><span className="inspector-label">Experiment tracking</span><strong>Immutable run lineage</strong></div><span className="secondary-status"><StatusDot type={experimentCatalog?.status === 'ready' ? 'complete' : 'progress'} />{experimentCatalog?.entries?.length ?? 0} experiments</span></div><table className="report-table"><thead><tr><th>Experiment</th><th>Model</th><th>Suite</th><th>Quality</th><th>Artifact hash</th></tr></thead><tbody>{(experimentCatalog?.entries ?? []).slice(0, 8).map((entry) => <tr key={entry.experiment_id}><th>{entry.experiment_id}</th><td>{entry.model.id}<br /><small>{entry.model.provider}</small></td><td>v{entry.suite.version}</td><td className="table-score">{typeof entry.metrics.quality_score === 'number' ? `${(entry.metrics.quality_score * 100).toFixed(1)}` : '—'}</td><td><code>{entry.artifact.report_hash?.slice(0, 12) ?? '—'}…</code></td></tr>)}</tbody></table></div>
    </>}

    {activeNav === 'Models' && <>
      <div className="metric-cards"><MetricCard label="Model" value={model.model_id ?? 'Current model'} detail={model.provider ?? 'provider pending'} /><MetricCard label="Runtime" value={modelExtra.runtime ?? 'not recorded'} detail="inference runtime" /><MetricCard label="Checkpoint" value={modelExtra.checkpoint ?? 'not recorded'} detail={modelExtra.training_commit ? `commit ${modelExtra.training_commit}` : 'post-training commit pending'} /></div>
      <div className="report-panel"><span className="inspector-label">Evaluation configuration</span><dl className="provenance-list"><div><dt>Temperature</dt><dd>{model.temperature ?? '—'}</dd></div><div><dt>Max tokens</dt><dd>{model.max_tokens ?? '—'}</dd></div><div><dt>Seed</dt><dd>{model.seed ?? '—'}</dd></div><div><dt>Score</dt><dd>{typeof summary.overall_score === 'number' ? `${(summary.overall_score * 100).toFixed(1)} / 100` : '—'}</dd></div></dl></div>
      <div className="report-panel table-scroll"><span className="inspector-label">Comparison registry</span><table className="report-table"><thead><tr><th>Model</th><th>Provider</th><th>Adapter</th><th>Suites</th><th>Configuration</th><th>Publication</th></tr></thead><tbody>{(modelCatalog?.models ?? []).map((entry) => <tr key={entry.id}><th>{entry.label}<br /><small>{entry.id}</small></th><td>{entry.provider}</td><td>{entry.adapter ?? 'openai-compatible'}</td><td>{entry.suite_versions?.join(', ') || '—'}</td><td>{entry.configured ? 'configured' : entry.adapter === 'command-line' ? 'CLI not configured' : entry.status === 'endpoint-not-configured' ? 'endpoint not configured' : 'not configured'}</td><td>{entry.publication}</td></tr>)}</tbody></table></div>
      <div className="report-panel table-scroll" data-testid="comparison-execution-contract"><div className="leaderboard-head"><div><span className="inspector-label">Comparison execution</span><strong>Same-suite lanes with release-locked scores</strong></div><span className="secondary-status"><StatusDot type={comparisonExecution?.status === 'ready' ? 'complete' : comparisonExecution?.status === 'blocked' ? 'error' : 'progress'} />{comparisonExecution?.status ?? 'not loaded'}</span></div><p className="comparison-contract-copy">{comparisonExecution?.suite?.version ? `v${comparisonExecution.suite.version} · ${comparisonExecution.execution?.completed_models ?? 0} of ${comparisonExecution.execution?.total_models ?? 0} lanes completed` : 'Run the comparison wrapper to create an archive evidence contract.'} Scores stay locked until the release gate and human calibration pass.</p><table className="report-table"><thead><tr><th>Model</th><th>Status</th><th>Run</th><th>Score</th></tr></thead><tbody>{(comparisonExecution?.models ?? []).map((entry) => <tr key={entry.id}><th>{entry.label}<br /><small>{entry.id}</small></th><td>{entry.status}</td><td><code>{entry.run_id ?? 'not run'}</code></td><td>{entry.score === null ? 'locked' : `${(entry.score * 100).toFixed(1)}`}</td></tr>)}</tbody></table></div>
    </>}

    {activeNav === 'Tasks' && <div className="report-panel table-scroll"><table className="report-table"><thead><tr><th>Task</th><th>Category</th><th>Status</th><th>Score</th><th>Latency</th></tr></thead><tbody>{displayTasks.map((task) => <tr key={task.id}><th>{task.name}</th><td>{task.category}</td><td><span className="status-label"><StatusDot type={task.statusType} />{task.status}</span></td><td className="table-score">{task.score}</td><td>{task.latency}</td></tr>)}</tbody></table></div>}

    {activeNav === 'Datasets' && <>
      <div className="metric-cards"><MetricCard label="Suite" value={run.suite_id ?? 'dhevals-heavy-user-ptbr'} detail={`version ${run.suite_version ?? '0.1.0'}`} /><MetricCard label="Locale" value={reportArtifact?.run?.locale ?? 'pt-BR'} detail={`${summary.task_count ?? displayTasks.length} tasks in artifact`} /><MetricCard label="Publication" value={model.provider === 'fixture' ? 'fixture-only' : 'candidate'} detail="license and provenance stay in manifest" /></div>
      <div className="report-panel"><span className="inspector-label">Immutable identity</span><div className="hash-block"><code>{run.suite_hash ?? 'suite hash unavailable'}</code><button className="section-link" type="button" onClick={() => navigator.clipboard?.writeText(run.suite_hash ?? '')}>Copy hash</button></div></div>
      <div className="report-panel table-scroll"><span className="inspector-label">Versioned suite registry</span><table className="report-table"><thead><tr><th>Version</th><th>Tasks</th><th>Hash</th><th>Audit</th><th>Calibration</th></tr></thead><tbody>{(suiteCatalog?.suites ?? []).map((suite) => <tr key={`${suite.suite_id}@${suite.version}`}><th>{suite.version}{suite.current_public ? ' · public' : ''}</th><td>{suite.task_count}</td><td><code>{suite.content_hash?.slice(0, 12) ?? '—'}…</code></td><td>{suite.audit?.status ?? '—'}</td><td>{suite.calibration?.status ?? '—'} · {suite.calibration?.completed_groups ?? 0}/{suite.calibration?.required_groups ?? 0}</td></tr>)}</tbody></table></div>
      <div className="report-panel table-scroll" data-testid="dataset-registry"><div className="leaderboard-head"><div><span className="inspector-label">Dataset registry</span><strong>Source, privacy and license contract</strong></div><span className="secondary-status"><StatusDot type={datasetCatalog?.status === 'ready' ? 'complete' : 'progress'} />{datasetCatalog?.datasets?.length ?? 0} datasets</span></div><table className="report-table"><thead><tr><th>Dataset</th><th>Version</th><th>Status</th><th>Locale</th><th>License</th><th>Privacy</th><th>Manifest hash</th></tr></thead><tbody>{(datasetCatalog?.datasets ?? []).map((dataset) => <tr key={`${dataset.id}@${dataset.version}`}><th>{dataset.id}</th><td>{dataset.version}</td><td>{dataset.status}</td><td>{dataset.locale}</td><td>{dataset.license}</td><td>{dataset.privacy?.pii_allowed === false ? 'PII prohibited' : 'review required'}</td><td><code>{dataset.content_hash?.slice(0, 12) ?? '—'}…</code></td></tr>)}</tbody></table></div>
    </>}

    {activeNav === 'Benchmarks' && <><div className="report-panel table-scroll"><table className="report-table"><thead><tr><th>Category</th><th>Tasks</th><th>Coverage</th><th>Score</th><th>Tokens</th></tr></thead><tbody>{categories.map((category) => <tr key={category.category ?? category.name}><th>{category.category ?? category.name}</th><td>{category.task_count ?? '—'}</td><td>{typeof category.coverage === 'number' ? `${Math.round(category.coverage * 100)}%` : '—'}</td><td className="table-score">{typeof category.score === 'number' ? `${(category.score * 100).toFixed(1)}` : '—'}</td><td>{category.tokens_total?.toLocaleString?.('en-US') ?? '—'}</td></tr>)}</tbody></table></div><div className="report-panel leaderboard-panel"><div className="leaderboard-head"><div><span className="inspector-label">Public leaderboard</span><strong>{leaderboard?.status === 'ready' ? 'Ready to publish' : 'Draft · publication locked'}</strong></div><span className="secondary-status"><StatusDot type={leaderboard?.status === 'ready' ? 'complete' : 'progress'} />{leaderboard?.entries?.length ?? 0} runs</span></div><div className="table-scroll"><table className="report-table"><thead><tr><th>Rank</th><th>Model</th><th>Provider</th><th>Score</th><th>Status</th></tr></thead><tbody>{(leaderboard?.entries ?? []).map((entry) => <tr key={entry.run_id}><td>{entry.rank ?? '—'}</td><th>{entry.model_id ?? 'unknown'}</th><td>{entry.provider}</td><td className="table-score">{typeof entry.score === 'number' ? `${(entry.score * 100).toFixed(1)}` : 'locked'}</td><td>{entry.publication_status === 'eligible' ? 'Eligible' : entry.lock_reason}</td></tr>)}</tbody></table></div></div><div className="report-panel table-scroll" data-testid="test-matrix-contract"><div className="leaderboard-head"><div><span className="inspector-label">Versioned test matrix</span><strong>Executable benchmark contract</strong></div><span className="secondary-status"><StatusDot type={testMatrixCatalog?.status === 'ready' ? 'complete' : 'progress'} />{testMatrixCatalog?.status ?? 'not loaded'}</span></div><table className="report-table"><thead><tr><th>Suite</th><th>Tasks</th><th>Scenarios</th><th>Rubric dimensions</th><th>Scorecard dimensions</th><th>Anchor groups</th><th>Models</th></tr></thead><tbody>{(testMatrixCatalog?.versions ?? []).map((entry) => <tr key={entry.version}><th>v{entry.version}</th><td>{entry.task_count}</td><td>{entry.scenario_count}</td><td>{entry.rubric_dimension_count}</td><td>{entry.scorecard_dimension_count ?? '—'}</td><td>{entry.anchor_group_count}</td><td>{entry.model_lane_count}</td></tr>)}</tbody></table></div><div className="report-panel table-scroll" data-testid="matrix-execution-contract"><div className="leaderboard-head"><div><span className="inspector-label">Matrix execution evidence</span><strong>Positive and negative scenarios verified</strong></div><span className="secondary-status"><StatusDot type={testExecution?.status === 'ready' ? 'complete' : 'progress'} />{testExecution?.coverage?.scenario_count ?? 0} scenarios</span></div><table className="report-table"><thead><tr><th>Suite</th><th>Tasks</th><th>Positive</th><th>Negative</th><th>Hash</th></tr></thead><tbody>{(testExecution?.entries ?? []).map((entry) => <tr key={entry.suite_version}><th>v{entry.suite_version}</th><td>{entry.matrix.task_count}</td><td className="table-score">{entry.scenarios.positive.status} · {entry.scenarios.positive.score}</td><td>{entry.scenarios.negative.status} · {entry.scenarios.negative.score}</td><td><code>{entry.suite_hash?.slice(0, 12) ?? '—'}…</code></td></tr>)}</tbody></table></div></>}

    {activeNav === 'Calibration' && !reviewerMode && <>
      <div className="metric-cards calibration-metrics">
        <MetricCard label="Gate status" value={calibration.status ?? 'not run'} detail={calibration.ready ? 'leaderboard may publish' : 'leaderboard remains locked'} />
        <MetricCard label="Anchor coverage" value={`${calibrationPercent.toFixed(1)}%`} detail={`${calibration.completed_groups ?? 0} / ${calibration.required_groups ?? 0} groups`} />
        <MetricCard label="Reviewers" value={`${calibrationReview.reviewers_present ?? 0} / ${calibrationReview.reviewers_required ?? 2}`} detail={`${calibrationReview.responses_total ?? 0} scored responses`} />
      </div>
      <div className="report-panel calibration-progress-panel" data-testid="calibration-progress">
        <div className="calibration-progress-head"><div><span className="inspector-label">Human calibration gate</span><strong data-testid="calibration-status"><StatusDot type={calibration.status === 'ready' ? 'complete' : calibration.status === 'invalid' ? 'error' : 'progress'} />{calibration.status ?? 'not run'}</strong></div><div className="calibration-progress-actions"><span className="secondary-status">{calibration.completed_groups ?? 0} of {calibration.required_groups ?? 0} groups</span><button className="director-button" type="button" onClick={() => setReviewerMode(true)}>Open reviewer workspace</button></div></div>
        <div className="progress-track calibration-track"><span style={{ width: `${Math.min(100, Math.max(0, calibrationPercent))}%` }} /></div>
        <dl className="provenance-list calibration-provenance"><div><dt>Pending groups</dt><dd>{calibration.missing_groups?.length ?? 0}</dd></div><div><dt>Disagreements</dt><dd>{calibration.disagreement_groups?.length ?? 0}</dd></div><div><dt>Adjudicated</dt><dd>{calibration.adjudicated_groups?.length ?? 0}</dd></div><div><dt>Leaderboard</dt><dd>{calibration.gate?.leaderboard ?? 'locked'}</dd></div></dl>
      </div>
      <div className="report-panel table-scroll"><span className="inspector-label">Reviewer coverage</span><table className="report-table"><thead><tr><th>Reviewer</th><th>Responses</th><th>Groups reviewed</th></tr></thead><tbody>{(calibrationReview.reviewers ?? []).length ? calibrationReview.reviewers.map((reviewer) => <tr key={reviewer.reviewer_id}><th>{reviewer.reviewer_id}</th><td>{reviewer.responses}</td><td>{reviewer.groups_reviewed}</td></tr>) : <tr><td colSpan="3">No reviewer scores imported yet.</td></tr>}</tbody></table></div>
      <div className="report-panel report-copy calibration-audit"><span className="inspector-label">Audit trail</span><p>Every status above is derived from the rubric, examples, response payload and reviewer worksheets. The public artifact never contains reviewer secrets.</p><dl className="provenance-list"><div><dt>Summary</dt><dd>{calibration.audit?.summary ?? '—'}</dd></div><div><dt>Responses</dt><dd>{calibration.audit?.responses ?? '—'}</dd></div><div><dt>Rubric</dt><dd>{calibration.audit?.rubric ?? '—'}</dd></div><div><dt>Blind sheets</dt><dd>{calibration.audit?.blind_sheets?.join(', ') || 'not generated'}</dd></div><div><dt>Pack</dt><dd>{calibration.audit?.pack ?? 'not generated'}</dd></div><div><dt>Validation errors</dt><dd>{calibration.validation_errors?.length ?? 0}</dd></div></dl></div>
      <div className="report-panel expanded-calibration-panel" data-testid="expanded-calibration-progress"><div className="calibration-progress-head"><div><span className="inspector-label">Expanded calibration track · v0.3</span><strong><StatusDot type={calibrationExpandedArtifact?.status === 'ready' ? 'complete' : 'progress'} />{calibrationExpandedArtifact?.status ?? 'not imported'}</strong></div><span className="secondary-status">{calibrationExpandedArtifact ? `${calibrationExpandedArtifact.completed_groups ?? 0} of ${calibrationExpandedArtifact.required_groups ?? 300} groups` : '300 groups'}</span></div><p className="expanded-calibration-copy">The v0.3 reviewer pack is derived separately so the v0.2 public baseline remains unchanged. Import the two blinded CSVs when human review is complete.</p><div className="report-panel calibration-handoff-inline" data-testid="calibration-handoff"><div className="calibration-progress-head"><div><span className="inspector-label">Reviewer handoff</span><strong>{calibrationHandoff?.status ?? 'not generated'}</strong></div><span className="secondary-status">{calibrationHandoff?.review_policy?.required_groups ?? 300} groups · {calibrationHandoff?.reviewers?.length ?? 2} reviewers</span></div><dl className="provenance-list"><div><dt>Reviewer A</dt><dd>{calibrationHandoff?.reviewers?.find?.((reviewer) => reviewer.reviewer_id === 'reviewer-a')?.rows ?? 0} rows · {calibrationHandoff?.reviewers?.find?.((reviewer) => reviewer.reviewer_id === 'reviewer-a')?.scored_rows ?? 0} scored</dd></div><div><dt>Reviewer B</dt><dd>{calibrationHandoff?.reviewers?.find?.((reviewer) => reviewer.reviewer_id === 'reviewer-b')?.rows ?? 0} rows · {calibrationHandoff?.reviewers?.find?.((reviewer) => reviewer.reviewer_id === 'reviewer-b')?.scored_rows ?? 0} scored</dd></div><div><dt>Pack fingerprint</dt><dd><code>{calibrationHandoff?.suite?.anchor_fingerprint?.slice(0, 12) ?? '—'}…</code></dd></div></dl></div><div className="report-actions"><a className="ghost-button" href="/data/calibration/v0.3/progress.json" target="_blank" rel="noreferrer">Open v0.3 progress</a><a className="ghost-button" href="/data/calibration/v0.3/handoff.json" target="_blank" rel="noreferrer">Open handoff</a><button className="director-button" type="button" onClick={() => setReviewerMode(true)}>Review v0.3 anchors</button></div></div>
    </>}

    {activeNav === 'Calibration' && reviewerMode && <CalibrationReviewer onClose={() => setReviewerMode(false)} />}

    {activeNav === 'Reports' && <>
      <div className="metric-cards"><MetricCard label="Canonical report" value={reportArtifact ? 'synced' : 'pending'} detail="latest-report.json" /><MetricCard label="YouTube pack" value={youtubePack ? 'ready' : 'pending'} detail="latest-youtube-pack.json" /><MetricCard label="Estimated cost" value={typeof summary.estimated_cost_usd_total === 'number' ? `US$ ${summary.estimated_cost_usd_total.toFixed(6)}` : 'not configured'} detail="optional token pricing" /><MetricCard label="Limitations" value={youtubePack?.limitations?.length ?? '—'} detail="shown before publication" /></div>
      <div className="report-panel scorecard-panel" data-testid="scorecard-contract"><div className="leaderboard-head"><div><span className="inspector-label">Transparent scorecard</span><strong>{scorecardStatus === 'eligible' ? 'Eligible for publication' : 'Publication locked until all gates pass'}</strong></div><span className="secondary-status"><StatusDot type={scorecardStatus === 'eligible' ? 'complete' : 'progress'} />{scorecardStatus}</span></div><div className="metric-cards scorecard-metrics"><MetricCard label="Quality" value={typeof scorecardQuality === 'number' ? `${(scorecardQuality * 100).toFixed(1)} / 100` : 'not evaluated'} detail="deterministic report" /><MetricCard label="Safety" value={scorecardDimensions.safety?.status === 'not_evaluated' ? 'not evaluated' : (scorecardDimensions.safety?.status ?? 'not evaluated')} detail={typeof scorecardDimensions.safety?.score === 'number' ? `${(scorecardDimensions.safety.score * 100).toFixed(1)} / 100` : 'independent suite required'} /><MetricCard label="Agentic" value={scorecardDimensions.agentic?.status === 'not_evaluated' ? 'not evaluated' : (scorecardDimensions.agentic?.status ?? 'not evaluated')} detail={typeof scorecardDimensions.agentic?.score === 'number' ? `${(scorecardDimensions.agentic.score * 100).toFixed(1)} / 100` : 'trace suite required'} /><MetricCard label="LLM judge" value={typeof judgeScore === 'number' ? `${(judgeScore * 100).toFixed(1)} / 100` : judgeStatus === 'not_evaluated' ? 'not evaluated' : judgeStatus} detail={judgeArtifact?.judge_model?.id ?? 'independent artifact'} /></div><dl className="provenance-list"><div><dt>Calibration</dt><dd>{scorecard?.calibration?.status ?? 'not available'}</dd></div><div><dt>Coverage</dt><dd>{typeof scorecard?.operational?.coverage === 'number' ? `${Math.round(scorecard.operational.coverage * 100)}%` : '—'}</dd></div><div><dt>Average latency</dt><dd>{typeof scorecard?.operational?.average_latency_ms === 'number' ? `${scorecard.operational.average_latency_ms} ms` : '—'}</dd></div><div><dt>Unmeasured dimensions</dt><dd>{Object.values(scorecardDimensions).filter((dimension) => dimension.status === 'not_evaluated').length}</dd></div></dl></div>
      <div className="report-panel report-copy" data-testid="judge-contract"><div className="leaderboard-head"><div><span className="inspector-label">Independent LLM-as-a-Judge</span><strong>{judgeStatus === 'evaluated' || judgeStatus === 'ready' ? 'Evidence artifact available' : 'Not evaluated in public baseline'}</strong></div><span className="secondary-status"><StatusDot type={judgeStatus === 'evaluated' || judgeStatus === 'ready' ? 'complete' : judgeStatus === 'invalid' ? 'error' : 'progress'} />{judgeStatus}</span></div><p>{judgeArtifact?.metadata?.reason ?? 'The judge lane is intentionally separate from deterministic quality; configure an independent judge artifact before interpreting this dimension.'}</p><dl className="provenance-list"><div><dt>Judge model</dt><dd>{judgeArtifact?.judge_model?.id ?? 'not configured'}</dd></div><div><dt>Rubric hash</dt><dd><code>{judgeArtifact?.rubric_hash ?? 'not configured'}</code></dd></div><div><dt>Evaluations</dt><dd>{judgeArtifact?.evaluations?.length ?? 0}</dd></div><div><dt>Independent</dt><dd>{judgeArtifact?.metadata?.independent_from_quality === true ? 'yes' : 'contract required'}</dd></div></dl><div className="report-actions"><a className="ghost-button" href="/data/latest-judge.json" target="_blank" rel="noreferrer">Open judge artifact</a></div></div>
      <div className="report-panel report-copy"><span className="inspector-label">Factual hook</span><strong>{youtubePack?.hook ?? 'Generate a run to prepare the factual pack.'}</strong><ul>{(youtubePack?.facts ?? []).map((fact) => <li key={fact}>{fact}</li>)}</ul><div className="report-actions"><button className="ghost-button" type="button" onClick={onExportRun}><Glyph name="download" size={15} />Export run JSON</button><button className="director-button" type="button" onClick={onExportYoutube}><Glyph name="download" size={15} />Export YouTube pack</button><a className="ghost-button" href="/data/latest-report.html" target="_blank" rel="noreferrer">Open HTML report</a><a className="ghost-button" href="/data/latest-results.csv" download>Download CSV</a></div></div>
    </>}

    {activeNav === 'Settings' && <>
      <div className="metric-cards"><MetricCard label="Adapter" value={model.provider ?? 'openai-compatible'} detail="selected run provider" /><MetricCard label="Endpoint" value={model.provider === 'fixture' ? 'offline fixture' : 'configured by env'} detail="no secrets in UI" /><MetricCard label="Preflight" value={preflight?.status ?? 'not run'} detail={preflight ? `${preflight.latency_ms ?? '—'} ms · latest-preflight.json` : 'run before full evaluation'} /><MetricCard label="Verification" value={verificationArtifact?.status ?? 'not run'} detail={verificationArtifact ? `${verificationArtifact.checked?.result_count ?? '—'} results · hash checked` : 'run verifier before publication'} /><MetricCard label="Bundle audit" value={auditArtifact?.status ?? 'not run'} detail={auditArtifact ? `${auditArtifact.checks?.suite?.task_count ?? '—'} tasks · ${auditArtifact.checks?.rubric?.required_anchor_groups ?? '—'} anchors` : 'audit suite before publication'} /><MetricCard label="Release gate" value={releaseGate?.status ?? 'not run'} detail={releaseGate ? `${releaseGate.errors?.length ?? 0} blocking checks · latest-release-gate.json` : 'evaluate before publication'} /><MetricCard label="SaciLM readiness" value={sacilmReadiness?.status ?? 'not run'} detail={`${sacilmReadiness?.checks?.filter?.((check) => check.status !== 'ready').length ?? 0} external gates pending`} /><MetricCard label="E2E audit" value={goalAudit?.local_status ?? 'not run'} detail={`${goalAudit?.external_status ?? 'external gates unknown'} · ${goalAudit?.summary?.ready ?? 0}/${goalAudit?.summary?.total ?? 0} checks ready`} /><MetricCard label="Scorecard" value={scorecardStatus} detail={scorecard?.publication?.reason ?? 'not loaded'} /></div>
      <div className="report-panel report-copy" data-testid="goal-audit-contract"><div className="leaderboard-head"><div><span className="inspector-label">E2E goal audit</span><strong>Local path verified; publication gates remain explicit</strong></div><span className="secondary-status">{goalAudit?.status ?? 'not loaded'}</span></div><p>{goalAudit?.local_status === 'ready' ? 'The complete offline path is ready for repeatable runs.' : 'Run the goal audit to verify the local platform path.'} External readiness is tracked separately so no live model score is inferred from fixtures.</p><dl className="provenance-list"><div><dt>Local E2E</dt><dd>{goalAudit?.local_status ?? '—'}</dd></div><div><dt>External gates</dt><dd>{goalAudit?.external_status ?? '—'}</dd></div><div><dt>Checks ready</dt><dd>{goalAudit?.summary?.ready ?? 0} / {goalAudit?.summary?.total ?? 0}</dd></div><div><dt>Calibration handoff</dt><dd>{goalAudit?.checks?.find?.((check) => check.id === 'calibration_handoff')?.status ?? '—'}</dd></div></dl><div className="report-actions"><a className="ghost-button" href="/data/latest-goal-audit.json" target="_blank" rel="noreferrer">Open goal audit</a><a className="ghost-button" href="/data/calibration/v0.3/handoff.json" target="_blank" rel="noreferrer">Open calibration handoff</a></div></div>
      <div className="report-panel readiness-checklist" data-testid="sacilm-readiness-checklist"><div className="leaderboard-head"><div><span className="inspector-label">SaciLM readiness checklist</span><strong>{sacilmReadiness?.model?.id ?? 'SaciLM'} · external gates</strong></div><span className="secondary-status"><StatusDot type={sacilmReadiness?.status === 'ready' ? 'complete' : sacilmReadiness?.status === 'blocked' ? 'error' : 'progress'} />{sacilmReadiness?.status ?? 'not loaded'}</span></div><p className="readiness-copy">Cada linha é derivada de <code>latest-sacilm-readiness.json</code>. O diagnóstico não exibe URL completa, chaves ou valores secretos.</p><div className="readiness-list">{(sacilmReadiness?.checks ?? []).map((check) => <div className="readiness-row" key={check.id}><div className="readiness-row-title"><StatusDot type={check.status === 'ready' ? 'complete' : check.status === 'blocked' ? 'error' : 'progress'} /><strong>{check.id.replaceAll('_', ' ')}</strong><span className={`readiness-pill ${check.status}`}>{check.status}</span></div><span className="readiness-reason">{check.reason ?? 'contract verified'}</span></div>)}</div>{(sacilmReadiness?.next_actions ?? []).length > 0 && <div className="readiness-next"><span className="inspector-label">Next actions</span><ol>{sacilmReadiness.next_actions.map((action) => <li key={action}><code>{action}</code></li>)}</ol></div>}<div className="report-actions"><a className="ghost-button" href="/data/latest-sacilm-readiness.json" target="_blank" rel="noreferrer">Open readiness artifact</a><a className="ghost-button" href="/docs/dhevals-sacilm-run-checklist.md" target="_blank" rel="noreferrer">Open run checklist</a></div></div>
      <div className="report-panel report-copy"><span className="inspector-label">Runtime contract</span><p>O endpoint do SaciLM deve responder a <code>POST /v1/chat/completions</code>. Use <code>DHEVALS_SACILM_BASE_URL</code> e registre checkpoint, runtime e commit de post-training no artefato.</p><a href="/docs/dhevals-sacilm-runtime-contract.md">Open runtime contract</a></div>
    </>}
  </section>
}

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [selectedId, setSelectedId] = useState('research-synthesis')
  const [showSources, setShowSources] = useState(false)
  const [directorMode, setDirectorMode] = useState(false)
  const [toast, setToast] = useState('')
  const [runArtifact, setRunArtifact] = useState(null)
  const [reportArtifact, setReportArtifact] = useState(null)
  const [youtubePack, setYoutubePack] = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [preflight, setPreflight] = useState(null)
  const [calibrationArtifact, setCalibrationArtifact] = useState(null)
  const [calibrationExpandedArtifact, setCalibrationExpandedArtifact] = useState(null)
  const [calibrationHandoff, setCalibrationHandoff] = useState(null)
  const [verificationArtifact, setVerificationArtifact] = useState(null)
  const [auditArtifact, setAuditArtifact] = useState(null)
  const [releaseGate, setReleaseGate] = useState(null)
  const [sacilmReadiness, setSacilmReadiness] = useState(null)
  const [goalAudit, setGoalAudit] = useState(null)
  const [suiteCatalog, setSuiteCatalog] = useState(null)
  const [runCatalog, setRunCatalog] = useState(null)
  const [modelCatalog, setModelCatalog] = useState(null)
  const [testMatrixCatalog, setTestMatrixCatalog] = useState(null)
  const [testExecution, setTestExecution] = useState(null)
  const [datasetCatalog, setDatasetCatalog] = useState(null)
  const [scorecard, setScorecard] = useState(null)
  const [judgeArtifact, setJudgeArtifact] = useState(null)
  const [experimentCatalog, setExperimentCatalog] = useState(null)
  const [comparisonExecution, setComparisonExecution] = useState(null)
  const [runSyncState, setRunSyncState] = useState('loading')
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    const syncRun = async () => {
      try {
        const response = await fetch(`/data/latest-run.json?ts=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) throw new Error(`run artifact returned ${response.status}`)
        const artifact = await response.json()
        const [reportResponse, youtubeResponse, leaderboardResponse, runCatalogResponse, modelCatalogResponse, testMatrixResponse, testExecutionResponse, readinessResponse, datasetCatalogResponse, scorecardResponse, judgeResponse, experimentCatalogResponse, comparisonExecutionResponse, goalAuditResponse, calibrationHandoffResponse] = await Promise.all([
          fetch(`/data/latest-report.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/latest-youtube-pack.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/leaderboard.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/run-catalog.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/model-catalog.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/test-matrix-catalog.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/test-execution-latest.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/latest-sacilm-readiness.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/dataset-catalog.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/latest-scorecard.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/latest-judge.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/experiment-catalog.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/comparison-execution-latest.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/latest-goal-audit.json?ts=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/data/calibration/v0.3/handoff.json?ts=${Date.now()}`, { cache: 'no-store' }),
        ])
        const report = reportResponse.ok ? await reportResponse.json() : null
        const pack = youtubeResponse.ok ? await youtubeResponse.json() : null
        const board = leaderboardResponse.ok ? await leaderboardResponse.json() : null
        const runHistory = runCatalogResponse.ok ? await runCatalogResponse.json() : null
        const modelHistory = modelCatalogResponse.ok ? await modelCatalogResponse.json() : null
        const testMatrixHistory = testMatrixResponse.ok ? await testMatrixResponse.json() : null
        const testExecutionArtifact = testExecutionResponse.ok ? await testExecutionResponse.json() : null
        const readinessArtifact = readinessResponse.ok ? await readinessResponse.json() : null
        const datasetHistory = datasetCatalogResponse.ok ? await datasetCatalogResponse.json() : null
        const scorecardArtifact = scorecardResponse.ok ? await scorecardResponse.json() : null
        const judgeArtifactPayload = judgeResponse.ok ? await judgeResponse.json() : null
        const experimentHistory = experimentCatalogResponse.ok ? await experimentCatalogResponse.json() : null
        const comparisonExecutionArtifact = comparisonExecutionResponse.ok ? await comparisonExecutionResponse.json() : null
        const goalAuditArtifact = goalAuditResponse.ok ? await goalAuditResponse.json() : null
        const calibrationHandoffArtifact = calibrationHandoffResponse.ok ? await calibrationHandoffResponse.json() : null
        let preflightArtifact = null
        try {
          const preflightResponse = await fetch(`/data/latest-preflight.json?ts=${Date.now()}`, { cache: 'no-store' })
          const contentType = preflightResponse.headers.get('content-type') ?? ''
          if (preflightResponse.ok && contentType.includes('application/json')) preflightArtifact = await preflightResponse.json()
        } catch {
          preflightArtifact = null
        }
        let calibrationProgress = null
        try {
          const calibrationResponse = await fetch(`/data/latest-calibration.json?ts=${Date.now()}`, { cache: 'no-store' })
          const contentType = calibrationResponse.headers.get('content-type') ?? ''
          if (calibrationResponse.ok && contentType.includes('application/json')) calibrationProgress = await calibrationResponse.json()
        } catch {
          calibrationProgress = null
        }
        let expandedCalibrationProgress = null
        try {
          const expandedCalibrationResponse = await fetch(`/data/calibration/v0.3/progress.json?ts=${Date.now()}`, { cache: 'no-store' })
          const contentType = expandedCalibrationResponse.headers.get('content-type') ?? ''
          if (expandedCalibrationResponse.ok && contentType.includes('application/json')) expandedCalibrationProgress = await expandedCalibrationResponse.json()
        } catch {
          expandedCalibrationProgress = null
        }
        let verification = null
        try {
          const verificationResponse = await fetch(`/data/latest-verification.json?ts=${Date.now()}`, { cache: 'no-store' })
          const contentType = verificationResponse.headers.get('content-type') ?? ''
          if (verificationResponse.ok && contentType.includes('application/json')) verification = await verificationResponse.json()
        } catch {
          verification = null
        }
        let audit = null
        try {
          const auditResponse = await fetch(`/data/latest-audit.json?ts=${Date.now()}`, { cache: 'no-store' })
          const contentType = auditResponse.headers.get('content-type') ?? ''
          if (auditResponse.ok && contentType.includes('application/json')) audit = await auditResponse.json()
        } catch {
          audit = null
        }
        let release = null
        try {
          const releaseResponse = await fetch(`/data/latest-release-gate.json?ts=${Date.now()}`, { cache: 'no-store' })
          const contentType = releaseResponse.headers.get('content-type') ?? ''
          if (releaseResponse.ok && contentType.includes('application/json')) release = await releaseResponse.json()
        } catch {
          release = null
        }
        let catalog = null
        try {
          const catalogResponse = await fetch(`/data/suite-catalog.json?ts=${Date.now()}`, { cache: 'no-store' })
          const contentType = catalogResponse.headers.get('content-type') ?? ''
          if (catalogResponse.ok && contentType.includes('application/json')) catalog = await catalogResponse.json()
        } catch {
          catalog = null
        }
        if (!cancelled) {
          setRunArtifact(artifact)
          setReportArtifact(report)
          setYoutubePack(pack)
          setLeaderboard(board)
          setPreflight(preflightArtifact)
          setCalibrationArtifact(calibrationProgress)
          setCalibrationExpandedArtifact(expandedCalibrationProgress)
          setVerificationArtifact(verification)
          setAuditArtifact(audit)
          setReleaseGate(release)
          setSuiteCatalog(catalog)
          setRunCatalog(runHistory)
          setModelCatalog(modelHistory)
          setTestMatrixCatalog(testMatrixHistory)
          setTestExecution(testExecutionArtifact)
          setSacilmReadiness(readinessArtifact)
          setDatasetCatalog(datasetHistory)
          setScorecard(scorecardArtifact)
          setJudgeArtifact(judgeArtifactPayload)
          setExperimentCatalog(experimentHistory)
          setComparisonExecution(comparisonExecutionArtifact)
          setGoalAudit(goalAuditArtifact)
          setCalibrationHandoff(calibrationHandoffArtifact)
          setRunSyncState('synced')
        }
      } catch {
        if (!cancelled) setRunSyncState('demo')
      }
    }
    syncRun()
    const interval = window.setInterval(syncRun, 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [refreshNonce])

  const displayTasks = useMemo(() => {
    const results = runArtifact?.results ?? []
    const resultById = new Map(results.map((result) => [result.task_id, result]))
    const statusMap = {
      pass: { label: 'Completed', type: 'complete' },
      partial: { label: 'Review', type: 'progress' },
      fail: { label: 'Failed', type: 'error' },
      error: { label: 'Error', type: 'error' },
    }
    const templates = results.length ? tasks.filter((task) => resultById.has(task.id)) : [...tasks]
    const knownTaskIds = new Set(templates.map((task) => task.id))
    results.filter((result) => !knownTaskIds.has(result.task_id)).forEach((result) => {
      const generatedName = result.title || result.task_id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
      templates.push({
        id: result.task_id,
        name: generatedName,
        category: result.category || 'Other',
        score: '—',
        latency: '—',
        tokens: '—',
        started: '—',
        status: 'Pending',
        statusType: 'progress',
        percentile: '—',
        inputTokens: '—',
        outputTokens: '—',
        sources: 0,
        evidence: 'No evidence recorded yet.',
      })
    })

    return templates.map((task) => {
      const result = resultById.get(task.id)
      if (!result) return task
      const resultStatus = statusMap[result.status] ?? { label: result.status, type: 'progress' }
      const score = typeof result.score === 'number' ? (result.score * 100).toFixed(1) : '—'
      const latencyMs = result.metrics?.latency_ms
      const totalTokens = result.metrics?.total_tokens
      return {
        ...task,
        score,
        status: resultStatus.label,
        statusType: resultStatus.type,
        latency: typeof latencyMs === 'number' ? `${(latencyMs / 1000).toFixed(1)}s` : task.latency,
        tokens: typeof totalTokens === 'number' ? totalTokens.toLocaleString('en-US') : task.tokens,
        inputTokens: typeof result.metrics?.input_tokens === 'number' ? result.metrics.input_tokens.toLocaleString('en-US') : task.inputTokens,
        outputTokens: typeof result.metrics?.output_tokens === 'number' ? result.metrics.output_tokens.toLocaleString('en-US') : task.outputTokens,
        evidence: result.output || task.evidence,
      }
    })
  }, [runArtifact])

  const categoryData = useMemo(() => categories.map((category) => {
    const scores = displayTasks
      .filter((task) => task.category === category.name)
      .map((task) => Number.parseFloat(task.score))
      .filter((score) => Number.isFinite(score))
    return scores.length ? { ...category, score: scores.reduce((sum, score) => sum + score, 0) / scores.length } : category
  }).concat(
    [...new Set(displayTasks.map((task) => task.category))]
      .filter((category) => !categories.some((item) => item.name === category))
      .map((name) => {
        const scores = displayTasks
          .filter((task) => task.category === name)
          .map((task) => Number.parseFloat(task.score))
          .filter((score) => Number.isFinite(score))
        return { name, score: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0, baseline: 0 }
      }),
  ), [displayTasks])

  const selectedTask = useMemo(() => displayTasks.find((task) => task.id === selectedId) ?? displayTasks[0], [displayTasks, selectedId])
  const completedCount = runArtifact?.summary?.completed_count ?? displayTasks.filter((task) => task.statusType === 'complete').length
  const taskCount = runArtifact?.summary?.task_count ?? displayTasks.length
  const coveragePercent = taskCount ? Math.round((completedCount / taskCount) * 100) : 0
  const overallScore = typeof runArtifact?.summary?.overall_score === 'number' ? (runArtifact.summary.overall_score * 100).toFixed(1) : '78.4'
  const runLabel = runArtifact?.run ? `${runArtifact.run.suite_id} / v${runArtifact.run.suite_version}` : 'Heavy User / v0.2'
  const modelLabel = runArtifact?.run?.model?.model_id || 'SaciLM'
  const modelDisplayLabel = modelLabel.toLowerCase() === 'sacilm' ? 'SaciLM' : modelLabel
  const toolbarTitle = activeNav === 'Overview' ? 'Run overview' : activeNav

  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const downloadJson = (payload, filename, message) => {
    if (!payload) {
      notify('Nenhum artefato de rodada disponível')
      return
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    notify(message)
  }

  const exportRunArtifact = () => {
    const runId = runArtifact?.run?.id ?? 'dhevals-run'
    downloadJson(runArtifact, `dhevals-${runId}.json`, 'Exportação JSON baixada')
  }

  const exportYoutubePack = () => {
    const runId = runArtifact?.run?.id ?? 'dhevals-run'
    downloadJson(youtubePack, `dhevals-${runId}-youtube-pack.json`, 'Pacote factual para YouTube baixado')
  }

  return (
    <div className={`app-shell ${directorMode ? 'director-mode' : ''}`}>
      <aside className="navigation-rail">
        <div className="brand-lockup" aria-label="DHEvals">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>DHEvals</span>
        </div>
        <nav className="primary-nav" aria-label="Primary">
          {navItems.map(([label, icon]) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} type="button" onClick={() => setActiveNav(label)} aria-label={label} title={label} aria-current={activeNav === label ? 'page' : undefined}>
              <Glyph name={icon} size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <ActivityRail />
      </aside>

      <div className="app-content">
        <header className="topbar">
          <div className="run-context">
            <div className="context-block"><span className="context-label">Run</span><strong>{runLabel}</strong></div>
            <div className="context-divider" />
            <div className="context-block"><span className="context-label">Model</span><strong>{modelDisplayLabel}</strong></div>
          </div>
          <div className="run-meta">
            <span className="run-live"><StatusDot type="live" />Run live</span>
            <span className="run-id" data-testid="run-id">{runArtifact?.run?.id ?? 'demo-run'}</span>
            <span className="run-clock">00:24:38</span>
            <span className="run-started">Started 10:14:22 AM</span>
            <button className="icon-button broadcast-button" type="button" aria-label="Alternar modo de diretor de vídeo" onClick={() => setDirectorMode((value) => !value)}><Glyph name="broadcast" size={17} /></button>
          </div>
        </header>

        <div className="workspace">
          <main className="main-canvas">
            <div className="canvas-toolbar">
              <div>
                <h1>{toolbarTitle}</h1>
                <p data-testid="sync-state">Heavy-user benchmark · {taskCount} tasks · pt-BR · {runSyncState === 'synced' ? 'run artifact synced' : 'demo snapshot'}</p>
              </div>
              <div className="toolbar-actions">
                <button className="ghost-button" type="button" onClick={() => { setRefreshNonce((value) => value + 1); notify('Atualizando artefato da rodada') }}><Glyph name="runs" size={15} />Refresh run</button>
                <button className="ghost-button" type="button" onClick={exportRunArtifact}><Glyph name="download" size={15} />Export data</button>
                <button className={`director-button ${directorMode ? 'selected' : ''}`} type="button" onClick={() => setDirectorMode((value) => !value)}><Glyph name="broadcast" size={15} />{directorMode ? 'Exit director' : 'Director view'}</button>
              </div>
            </div>

            {directorMode && youtubePack && <section className="director-brief" data-testid="director-brief" aria-label="YouTube director brief">
              <div className="director-brief-copy">
                <span className="inspector-label">Director brief · factual pack</span>
                <strong>{youtubePack.hook}</strong>
                <div className="director-facts">{youtubePack.facts?.slice(0, 3).map((fact) => <span key={fact}>{fact}</span>)}</div>
              </div>
              <button className="director-button" type="button" onClick={exportYoutubePack}><Glyph name="download" size={15} />Export YouTube pack</button>
            </section>}

            {activeNav === 'Overview' ? <>
            <section className="overview-band" aria-labelledby="score-heading">
              <div className="score-lockup">
                <span className="score-label" id="score-heading">Overall score</span>
                <div className="score-value" data-testid="overall-score">{overallScore} <span>/ 100</span></div>
                <div className="series-legend">
                  <span><i className="legend-line current" />{modelDisplayLabel} <em>(current run)</em></span>
                  <span><i className="legend-line baseline" />Baseline <em>(comparison)</em></span>
                </div>
              </div>
              <CategoryChart categoryData={categoryData} currentLabel={modelDisplayLabel} activeCategory={selectedTask.category} onSelect={(category) => {
                const match = displayTasks.find((task) => task.category === category)
                if (match) setSelectedId(match.id)
              }} />
            </section>

            <section className="task-section" aria-labelledby="task-heading">
              <div className="section-heading">
                <div>
                  <h2 id="task-heading">Task run</h2>
                  <p data-testid="completed-count">{completedCount} of {taskCount} tasks completed · scoring in progress</p>
                </div>
                <button className="section-link" type="button" onClick={() => notify('Manifesto da rodada copiado')}><Glyph name="copy" size={14} />Copy manifest</button>
              </div>
              <div className="table-scroll">
                <table className="task-table">
                  <thead>
                    <tr><th scope="col">#</th><th scope="col">Task</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Score</th><th scope="col">Latency</th><th scope="col">Tokens</th><th scope="col">Started</th></tr>
                  </thead>
                  <tbody>
                    {displayTasks.map((task, index) => (
                      <tr key={task.id} className={selectedId === task.id ? 'selected' : ''} onClick={() => { setSelectedId(task.id); setShowSources(false) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(task.id); setShowSources(false) } }} tabIndex="0" aria-selected={selectedId === task.id}>
                        <td className="row-number">{index + 1}</td>
                        <th scope="row">{task.name}</th>
                        <td>{task.category}</td>
                        <td><span className="status-label"><StatusDot type={task.statusType} />{task.status}</span></td>
                        <td className="table-score">{task.score}</td>
                        <td>{task.latency}</td>
                        <td>{task.tokens}</td>
                        <td>{task.started}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="progress-row"><span>{completedCount} of {taskCount} tasks</span><div className="progress-track"><span style={{ width: `${coveragePercent}%` }} /></div><span>{coveragePercent}%</span></div>
            </section>
            </> : <SecondaryView activeNav={activeNav} runArtifact={runArtifact} reportArtifact={reportArtifact} youtubePack={youtubePack} leaderboard={leaderboard} preflight={preflight} calibrationArtifact={calibrationArtifact} calibrationExpandedArtifact={calibrationExpandedArtifact} calibrationHandoff={calibrationHandoff} verificationArtifact={verificationArtifact} auditArtifact={auditArtifact} releaseGate={releaseGate} sacilmReadiness={sacilmReadiness} goalAudit={goalAudit} suiteCatalog={suiteCatalog} runCatalog={runCatalog} modelCatalog={modelCatalog} testMatrixCatalog={testMatrixCatalog} testExecution={testExecution} datasetCatalog={datasetCatalog} scorecard={scorecard} judgeArtifact={judgeArtifact} experimentCatalog={experimentCatalog} comparisonExecution={comparisonExecution} displayTasks={displayTasks} categoryData={categoryData} onExportRun={exportRunArtifact} onExportYoutube={exportYoutubePack} />}
          </main>

          <aside className="inspector" aria-labelledby="inspector-heading">
            <div className="inspector-head">
              <div><span className="inspector-label">Selected task</span><h2 id="inspector-heading">{selectedTask.name}</h2></div>
              <button className="icon-button" type="button" aria-label="Fechar inspector" onClick={() => notify('Inspector permanece fixo nesta prévia')}><Glyph name="close" size={18} /></button>
            </div>
            <div className="inspector-meta"><div><span>Category</span><strong>{selectedTask.category}</strong></div><div><span>Status</span><strong className="status-label"><StatusDot type={selectedTask.statusType} />{selectedTask.status}</strong></div></div>
            <div className="inspector-score-block"><span className="inspector-label">Score</span><div className="inspector-score">{selectedTask.score} <small>/ 100</small></div><span className="percentile">{selectedTask.percentile} percentile</span></div>
            <div className="metric-grid"><div><span>Latency</span><strong>{selectedTask.latency}</strong></div><div><span>Tokens</span><strong>{selectedTask.tokens}</strong><small>({selectedTask.inputTokens} in / {selectedTask.outputTokens} out)</small></div></div>
            <div className="evidence-section"><div className="evidence-heading"><span className="inspector-label">Evidence</span><button className="icon-button small" type="button" aria-label="Copiar evidência" onClick={() => notify('Evidência copiada')}><Glyph name="copy" size={14} /></button></div><pre className="evidence-copy">{selectedTask.evidence}</pre></div>
            <button className={`source-button ${showSources ? 'expanded' : ''}`} type="button" onClick={() => setShowSources((value) => !value)}><span><Glyph name="source" size={15} />Sources ({selectedTask.sources || 'none'})</span><Glyph name="chevron" size={14} /></button>
            {showSources && <div className="source-list"><span>suite/heavy-user/v{runArtifact?.run?.suite_version?.split('.').slice(0, 2).join('.') ?? '0.2'}</span><span>{selectedTask.sources ? '12 licensed references · hashed' : 'No external source fixture'}</span></div>}
          </aside>
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export default App
