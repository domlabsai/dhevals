import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const publicDirectory = resolve(root, 'public/data/public')
const EVIDENCE_STATUSES = ['supported', 'estimated', 'pending', 'locked', 'invalid']
const RUN_STATUSES = ['promoted', 'verified', 'archive_only', 'locked', 'invalid']
// Absolute local paths and private design material must never appear in the
// public projection. Environment variable NAMES (e.g. DHEVALS_SACILM_BASE_URL)
// are already part of the committed public docs and readiness artifacts, so
// they are not secrets; secret VALUES are caught by FORBIDDEN_PATTERNS below.
const FORBIDDEN_FRAGMENTS = ['/Users/', 'artifacts/private']
const FORBIDDEN_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]{8,}/i,
  /\bsk-[A-Za-z0-9]{8,}/,
  /(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9._/-]{8,}/i,
]
const errors = []

main()

function main() {
  const overview = readJson('overview.json', true)
  const models = readJson('models.json', true)
  const suites = readJson('suites.json', true)
  const runsIndex = readJson('runs.json', true)
  const leaderboard = readJson('leaderboard.json', true)
  const inauguration = readJson('inauguration.json', true)
  const comparison = readJson('comparison.json', true)
  if (!existsSync(resolve(publicDirectory, 'catalog.csv'))) errors.push('catalog.csv: file is missing')

  if (overview) checkOverview(overview)
  if (Array.isArray(models)) checkModels(models)
  if (Array.isArray(suites)) checkSuites(suites)
  if (runsIndex) checkRunsIndex(runsIndex)
  if (leaderboard) checkLeaderboard(leaderboard)
  if (inauguration) checkInauguration(inauguration)
  if (comparison) checkComparison(comparison)

  for (const file of ['overview.json', 'models.json', 'suites.json', 'runs.json', 'leaderboard.json', 'inauguration.json', 'comparison.json', 'catalog.csv']) {
    const path = resolve(publicDirectory, file)
    if (!existsSync(path)) continue
    scanForForbidden(readFileSync(path, 'utf8'), file)
    scanForHiddenModel(readFileSync(path, 'utf8'), file)
    scanForSuppressedBaseline(readFileSync(path, 'utf8'), file)
  }

  if (runsIndex && Array.isArray(runsIndex.entries)) {
    const expectedRunFiles = new Set(runsIndex.entries.map((entry) => `${entry.id}.json`))
    const runsDirectory = resolve(publicDirectory, 'runs')
    if (existsSync(runsDirectory)) {
      for (const file of readdirSync(runsDirectory).filter((candidate) => candidate.endsWith('.json'))) {
        if (!expectedRunFiles.has(file)) errors.push(`runs/${file}: orphaned detail file is not indexed`)
      }
    }
    for (const entry of runsIndex.entries) {
      const detailPath = resolve(publicDirectory, 'runs', `${entry.id}.json`)
      if (!existsSync(detailPath)) {
        errors.push(`runs/${entry.id}.json: file is missing`)
        continue
      }
      const raw = readFileSync(detailPath, 'utf8')
      scanForForbidden(raw, `runs/${entry.id}.json`)
      scanForHiddenModel(raw, `runs/${entry.id}.json`)
      scanForSuppressedBaseline(raw, `runs/${entry.id}.json`)
      let detail = null
      try {
        detail = JSON.parse(raw)
      } catch {
        errors.push(`runs/${entry.id}.json: malformed JSON`)
        continue
      }
      checkRunDetail(entry.id, detail)
    }
  }

  if (errors.length) {
    console.error(JSON.stringify({ status: 'failed', kind: 'dhevals_public_projection_test', errors }, null, 2))
    process.exit(2)
  }
  console.log(JSON.stringify({
    status: 'passed',
    kind: 'dhevals_public_projection_test',
    files: 8 + (runsIndex?.entries?.length || 0),
    runs: runsIndex?.entries?.length || 0,
    ranked: Array.isArray(leaderboard?.ranked) ? leaderboard.ranked.length : 0,
  }, null, 2))
}

function checkComparison(report) {
  requireFields('comparison.json', report, ['kind', 'schema_version', 'title', 'generated_at', 'publication', 'benchmark', 'candidates', 'comparison', 'limitations'])
  if (report.kind !== 'dhevals_model_comparison_report') errors.push('comparison.json: kind is invalid')
  if (report.publication !== 'archive-only') errors.push('comparison.json: publication must remain archive-only')
  if (!Array.isArray(report.candidates) || report.candidates.length !== 2) errors.push('comparison.json: expected exactly two candidates')
  if (report.benchmark?.coverage !== undefined && report.benchmark.coverage !== 1) errors.push('comparison.json: coverage must be full when present')
  if (report.comparison?.winner_declared === true) errors.push('comparison.json: comparative report must not declare a winner')
}

function checkOverview(overview) {
  requireFields('overview.json', overview, ['schema_version', 'kind', 'generated_at', 'source_revision', 'latest_signal', 'calibration', 'counts', 'methodology_version'])
  if (overview.kind !== 'dhevals_public_overview') errors.push('overview.json: kind must be dhevals_public_overview')
  if (overview.latest_signal) {
    const signal = overview.latest_signal
    requireFields('overview.json latest_signal', signal, ['run_id', 'model_id', 'model_name', 'provider', 'suite_id', 'suite_version', 'score', 'coverage', 'evidence_status', 'is_fixture', 'date'])
    checkScore('overview.json latest_signal.score', signal.score)
    if (!EVIDENCE_STATUSES.includes(signal.evidence_status)) errors.push(`overview.json: latest_signal.evidence_status "${signal.evidence_status}" is not in the allowed enum`)
    if (signal.is_fixture && signal.score !== null) errors.push('overview.json: fixture latest_signal must not publish a score')
  }
  if (overview.calibration) requireFields('overview.json calibration', overview.calibration, ['status', 'completed_groups', 'required_groups'])
  if (overview.counts) requireFields('overview.json counts', overview.counts, ['suites', 'models', 'runs', 'promoted_runs'])
}

function checkInauguration(report) {
  requireFields('inauguration.json', report, ['kind', 'schema_version', 'title', 'generated_at', 'publication', 'model', 'overall', 'stages', 'timeout_policy', 'methodology'])
  if (report.kind !== 'dhevals_inauguration_report') errors.push('inauguration.json: kind is invalid')
  if (report.publication !== 'archive-only') errors.push('inauguration.json: publication must remain archive-only')
  if (String(report.model?.model_id || '').toLowerCase().includes('sacilm')) errors.push('inauguration.json: hidden model leaked')
  if (!Array.isArray(report.stages) || report.stages.length !== 3) errors.push('inauguration.json: expected exactly three stages')
  if (report.overall?.coverage !== 1) errors.push('inauguration.json: inauguration must have full coverage')
  for (const stage of report.stages || []) {
    requireFields(`inauguration.json stage ${stage?.suite_version ?? '?'}`, stage, ['label', 'suite_version', 'run_id', 'task_count', 'completed_count', 'coverage', 'score', 'status_counts', 'detail_path'])
    if (stage.coverage !== 1) errors.push(`inauguration.json stage ${stage.suite_version}: coverage must be 1`)
    if (!String(stage.detail_path || '').startsWith('/reports/')) errors.push(`inauguration.json stage ${stage.suite_version}: detail_path must be public`)
  }
}

function checkModels(models) {
  for (const model of models) {
    const label = `models.json ${model?.id ?? '?'}`
    requireFields(label, model, ['id', 'slug', 'name', 'provider', 'status', 'license', 'capabilities', 'category_scores', 'quality_score', 'ranking_status', 'ranking_runs', 'ranking_task_count', 'ranking_coverage', 'promoted', 'evidence_status', 'evidence_coverage', 'last_verified_at', 'bench_run_date', 'metrics', 'sources', 'notes'])
    if (!EVIDENCE_STATUSES.includes(model.evidence_status)) errors.push(`${label}: evidence_status "${model.evidence_status}" is not in the allowed enum`)
    if (!['current', 'calibration_pending', 'not_configured'].includes(model.status)) errors.push(`${label}: status "${model.status}" is not in the allowed enum`)
    checkScore(`${label} quality_score`, model.quality_score)
    if (!['archive_only_ranked', 'not_ranked'].includes(model.ranking_status)) errors.push(`${label}: ranking_status must be archive_only_ranked or not_ranked`)
    if (!Array.isArray(model.ranking_runs)) errors.push(`${label}: ranking_runs must be an array`)
    if (typeof model.promoted !== 'boolean' || model.promoted) errors.push(`${label}: promoted must remain false in the archive-only projection`)
    if (model.ranking_coverage !== null && (typeof model.ranking_coverage !== 'number' || model.ranking_coverage < 0 || model.ranking_coverage > 1)) errors.push(`${label}: ranking_coverage must be null or 0-1`)
    if (model.ranking_status === 'archive_only_ranked' && (typeof model.quality_score !== 'number' || !model.ranking_runs.length || model.ranking_coverage !== 1)) errors.push(`${label}: archive-only ranked models need a score, run ids and full ranking coverage`)
    if (model.evidence_coverage !== null && (typeof model.evidence_coverage !== 'number' || model.evidence_coverage < 0 || model.evidence_coverage > 1)) {
      errors.push(`${label}: evidence_coverage must be null or 0-1`)
    }
    checkCategoryScores(`${label} category_scores`, model.category_scores)
    if (model.bench_run_date !== null && typeof model.bench_run_date !== 'string') errors.push(`${label}: bench_run_date must be a timestamp string or null`)
    if (model.metrics) {
      requireFields(`${label} metrics`, model.metrics, ['input_cost_per_1k', 'output_cost_per_1k', 'cost_per_1k', 'run_cost_usd', 'tokens_total', 'latency_ms', 'tokens_per_second', 'context_tokens', 'token_count_source', 'cost_source', 'cost_is_estimate', 'cost_estimate_warning', 'pricing_fetched_at'])
      if (typeof model.metrics.cost_is_estimate !== 'boolean') errors.push(`${label}: metrics.cost_is_estimate must be boolean`)
    }
    if (String(model.id).includes('fixture') || String(model.id).includes('negative')) errors.push(`${label}: fixture or negative model leaked into the public model list`)
  }
}

function checkSuites(suites) {
  for (const suite of suites) {
    const label = `suites.json ${suite?.id ?? '?'}@${suite?.version ?? '?'}`
    requireFields(label, suite, ['id', 'version', 'slug', 'title', 'language', 'task_count', 'categories', 'dimension_count', 'status', 'manifest_hash', 'last_reviewed_at', 'current_public', 'description', 'license', 'calibration'])
    if (!['fixture_only', 'calibration_pending', 'calibrated', 'verified', 'promoted'].includes(suite.status)) errors.push(`${label}: status "${suite.status}" is not in the allowed enum`)
    if (suite.manifest_hash !== null && !String(suite.manifest_hash).startsWith('sha256:')) errors.push(`${label}: manifest_hash must carry the sha256: prefix`)
    if (typeof suite.dimension_count !== 'number') errors.push(`${label}: dimension_count must be a number`)
  }
}

function checkRunsIndex(runsIndex) {
  requireFields('runs.json', runsIndex, ['schema_version', 'kind', 'generated_at', 'entries'])
  if (!Array.isArray(runsIndex.entries)) {
    errors.push('runs.json: entries must be an array')
    return
  }
  for (const entry of runsIndex.entries) {
    const label = `runs.json ${entry?.id ?? '?'}`
    requireFields(label, entry, ['id', 'model_id', 'model_name', 'provider', 'suite_id', 'suite_version', 'run_status', 'quality_score', 'coverage', 'verified', 'is_fixture', 'archive_only', 'lock_reason', 'started_at', 'completed_at', 'task_count', 'error_count', 'artifacts'])
    if (!RUN_STATUSES.includes(entry.run_status)) errors.push(`${label}: run_status "${entry.run_status}" is not in the allowed enum`)
    checkScore(`${label} quality_score`, entry.quality_score)
    if (typeof entry.verified !== 'boolean' || typeof entry.is_fixture !== 'boolean') errors.push(`${label}: verified and is_fixture must be booleans`)
    if (entry.is_fixture && entry.quality_score !== null) errors.push(`${label}: fixture runs must not publish a quality_score`)
    if (entry.run_status === 'invalid' && entry.quality_score !== null) errors.push(`${label}: invalid runs must not publish a quality_score`)
    if (entry.artifacts?.json !== `/data/public/runs/${entry.id}.json`) errors.push(`${label}: artifacts.json must point at /data/public/runs/${entry.id}.json`)
  }
}

function checkLeaderboard(leaderboard) {
  requireFields('leaderboard.json', leaderboard, ['schema_version', 'kind', 'generated_at', 'methodology', 'ranked', 'not_ranked'])
  if (leaderboard.kind !== 'dhevals_public_leaderboard') errors.push('leaderboard.json: kind must be dhevals_public_leaderboard')
  if (!Array.isArray(leaderboard.ranked) || !Array.isArray(leaderboard.not_ranked)) {
    errors.push('leaderboard.json: ranked and not_ranked must be arrays')
    return
  }
  for (const entry of leaderboard.ranked) {
    const label = `leaderboard.json ranked ${entry?.model_id ?? '?'}`
    requireFields(label, entry, ['model_id', 'model_name', 'provider', 'quality_score', 'category_scores', 'metrics', 'license', 'bench_run_date', 'run_ids', 'last_verified_at'])
    if (entry.verified !== true) errors.push(`${label}: ranked entries must be verified`)
    if (entry.coverage !== 1) errors.push(`${label}: ranked entries must have full coverage`)
    if (entry.is_fixture === true) errors.push(`${label}: fixture runs must never be ranked`)
    if (entry.archive_only !== true || entry.promoted !== false || entry.ranking_status !== 'archive_only_ranked') errors.push(`${label}: ranked entries must be explicitly archive-only and not promoted`)
    if (!Array.isArray(entry.run_ids) || !entry.run_ids.length) errors.push(`${label}: ranked entries need source run ids`)
    checkScore(`${label} quality_score`, entry.quality_score)
    checkCategoryScores(`${label} category_scores`, entry.category_scores)
    if (entry.bench_run_date !== null && typeof entry.bench_run_date !== 'string') errors.push(`${label}: bench_run_date must be a timestamp string or null`)
    if (entry.metrics) {
      requireFields(`${label} metrics`, entry.metrics, ['cost_per_1k', 'run_cost_usd', 'tokens_total', 'latency_ms', 'context_tokens', 'token_count_source', 'cost_source', 'cost_is_estimate', 'cost_estimate_warning', 'pricing_fetched_at'])
      if (typeof entry.metrics.cost_is_estimate !== 'boolean') errors.push(`${label}: metrics.cost_is_estimate must be boolean`)
    }
  }
  for (const entry of leaderboard.not_ranked) {
    const label = `leaderboard.json not_ranked ${entry?.model_id ?? '?'}`
    requireFields(label, entry, ['model_id', 'model_name', 'provider', 'reason', 'evidence_status', 'last_activity_at'])
    if (!['locked', 'pending', 'not_configured'].includes(entry.reason)) errors.push(`${label}: reason "${entry.reason}" is not in the allowed enum`)
    if (!EVIDENCE_STATUSES.includes(entry.evidence_status)) errors.push(`${label}: evidence_status "${entry.evidence_status}" is not in the allowed enum`)
  }
}

function checkRunDetail(id, detail) {
  const label = `runs/${id}.json`
  requireFields(label, detail, ['schema_version', 'kind', 'generated_at', 'run', 'run_status', 'is_fixture', 'archive_only', 'verified', 'summary', 'categories', 'tasks', 'verification', 'provenance'])
  if (!RUN_STATUSES.includes(detail.run_status)) errors.push(`${label}: run_status "${detail.run_status}" is not in the allowed enum`)
  if (detail.run) requireFields(label, detail.run, ['id', 'suite_id', 'suite_version', 'suite_hash', 'model', 'runner_version', 'started_at', 'finished_at'])
  if (detail.run?.id && detail.run.id !== id) errors.push(`${label}: run.id does not match the file name`)
  if (detail.summary) {
    requireFields(label, detail.summary, ['task_count', 'completed_count', 'coverage', 'overall_score', 'error_count', 'estimated_cost_usd_total', 'tokens_total', 'token_count_source', 'cost_source', 'cost_is_estimate', 'cost_estimate_warning'])
    checkScore(`${label} summary.overall_score`, detail.summary.overall_score)
    if (typeof detail.summary.cost_is_estimate !== 'boolean') errors.push(`${label}: summary.cost_is_estimate must be boolean`)
    if (detail.run_status === 'invalid' && detail.summary.overall_score !== null) errors.push(`${label}: invalid run detail must not expose an overall score`)
  }
  if (Array.isArray(detail.tasks)) {
    for (const task of detail.tasks) {
      requireFields(`${label} task ${task?.task_id ?? '?'}`, task, ['task_id', 'title', 'category', 'status', 'score', 'latency_ms', 'tokens', 'token_count_source', 'estimated_cost_usd', 'cost_is_estimate', 'failure_reason', 'prompt', 'output', 'checks'])
    }
  } else {
    errors.push(`${label}: tasks must be an array`)
  }
  if (detail.provenance?.source_report && String(detail.provenance.source_report).includes('/')) {
    errors.push(`${label}: provenance.source_report must be a basename, not a path`)
  }
}

function requireFields(label, value, fields) {
  if (!value || typeof value !== 'object') {
    errors.push(`${label}: not an object`)
    return
  }
  for (const field of fields) {
    if (!(field in value)) errors.push(`${label}: missing required field "${field}"`)
  }
}

function checkScore(label, score) {
  if (score === null) return
  if (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 100) errors.push(`${label}: scores must be 0-100 or null`)
}

function checkCategoryScores(label, scores) {
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
    errors.push(`${label}: must be an object of category scores`)
    return
  }
  for (const [category, score] of Object.entries(scores)) checkScore(`${label}.${category}`, score)
}

function scanForForbidden(text, label) {
  for (const fragment of FORBIDDEN_FRAGMENTS) {
    if (text.includes(fragment)) errors.push(`${label}: contains forbidden fragment "${fragment}"`)
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = text.match(pattern)
    if (match) errors.push(`${label}: contains a secret-like value matching ${pattern}`)
  }
}

function scanForHiddenModel(text, label) {
  if (/sacilm/i.test(text)) errors.push(`${label}: contains a deferred model reference`)
}

function scanForSuppressedBaseline(text, label) {
  if (/baseline-gpt-4-turbo|GPT-4 Turbo baseline/i.test(text)) {
    errors.push(`${label}: contains the retired GPT-4 baseline reference`)
  }
}

function readJson(file, required) {
  const path = resolve(publicDirectory, file)
  if (!existsSync(path)) {
    if (required) errors.push(`${file}: file is missing`)
    return null
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    errors.push(`${file}: malformed JSON`)
    return null
  }
}
