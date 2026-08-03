import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outputDirectory = resolve(root, 'public/data/public')
const suiteCatalogPath = resolve(root, 'public/data/suite-catalog.json')
const modelCatalogPath = resolve(root, 'public/data/model-catalog.json')
const runCatalogPath = resolve(root, 'public/data/run-catalog.json')
const publicReportPath = resolve(root, 'public/data/latest-report.json')
const inaugurationSourcePath = resolve(root, 'reports/runs/opencode-deepseek-v4-flash-free-inaugural-report.json')

const EVIDENCE_STATUSES = ['supported', 'estimated', 'pending', 'locked', 'invalid']
const SUITE_TITLE = 'Heavy-user tasks — Brazilian Portuguese'
const METHODOLOGY_VERSION = '0.1.0'
const GENERATED_AT = new Date().toISOString()

try {
  main()
} catch (error) {
  console.error(JSON.stringify({ status: 'error', kind: 'dhevals_public_projection_build', message: error.message }, null, 2))
  process.exit(1)
}

function main() {
  const suiteCatalog = readRequiredJson(suiteCatalogPath)
  const modelCatalog = readRequiredJson(modelCatalogPath)
  const runCatalog = readRequiredJson(runCatalogPath)
  const inauguration = readRequiredJson(inaugurationSourcePath)
  if (!Array.isArray(suiteCatalog.suites)) fail('suite-catalog.json is missing a suites array')
  if (!Array.isArray(modelCatalog.models)) fail('model-catalog.json is missing a models array')
  if (!Array.isArray(runCatalog.entries)) fail('run-catalog.json is missing an entries array')

  const sourceRevision = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim()

  const suiteManifests = new Map()
  for (const suite of suiteCatalog.suites) {
    if (!suite.manifest) fail(`suite ${suite.suite_id} ${suite.version} is missing a manifest path`)
    const manifest = readRequiredJson(resolve(root, suite.manifest))
    suiteManifests.set(`${suite.suite_id}@${suite.version}`, manifest)
  }

  const runs = collectRuns(runCatalog)
  const modelEntries = buildModels(modelCatalog, runs, suiteCatalog)
  const suiteEntries = buildSuites(suiteCatalog, suiteManifests)
  const runEntries = runs.map(buildRunIndexEntry)
  const overview = buildOverview(runCatalog, runs, suiteCatalog, modelEntries, sourceRevision)
  const leaderboard = buildLeaderboard(modelEntries, runs)

  const runsOutputDirectory = resolve(outputDirectory, 'runs')
  mkdirSync(runsOutputDirectory, { recursive: true })
  const projectedRunIds = new Set(runs.map((run) => run.entry.run_id))
  for (const file of readdirSync(runsOutputDirectory)) {
    if (file.endsWith('.json') && !projectedRunIds.has(file.slice(0, -5))) {
      rmSync(resolve(runsOutputDirectory, file), { force: true })
    }
  }
  for (const run of runs) {
    const detail = buildRunDetail(run)
    writeJson(resolve(runsOutputDirectory, `${run.entry.run_id}.json`), detail)
  }
  writeJson(resolve(outputDirectory, 'overview.json'), overview)
  writeJson(resolve(outputDirectory, 'models.json'), modelEntries)
  writeJson(resolve(outputDirectory, 'suites.json'), suiteEntries)
  writeJson(resolve(outputDirectory, 'runs.json'), {
    schema_version: '1.0.0',
    kind: 'dhevals_public_runs_index',
    generated_at: GENERATED_AT,
    entries: runEntries,
  })
  writeJson(resolve(outputDirectory, 'leaderboard.json'), leaderboard)
  writeJson(resolve(outputDirectory, 'inauguration.json'), inauguration)
  writeFileSync(resolve(outputDirectory, 'catalog.csv'), buildCatalogCsv(runEntries), 'utf8')

  console.log(JSON.stringify({
    status: 'ok',
    kind: 'dhevals_public_projection_build',
    output: 'public/data/public',
    suites: suiteEntries.length,
    models: modelEntries.length,
    runs: runEntries.length,
    promoted_runs: overview.counts.promoted_runs,
    inauguration: true,
  }, null, 2))
}

function collectRuns(runCatalog) {
  const runs = []
  const seen = new Set()
  for (const entry of runCatalog.entries) {
    if (!entry.run_id || !entry.source) fail('run-catalog entry is missing run_id or source')
    if (isHiddenModel(entry.model_id)) continue
    const reportPath = resolve(root, entry.source)
    const report = readRequiredJson(reportPath)
    if (report?.run?.id !== entry.run_id) fail(`report ${entry.source} does not match run ${entry.run_id}`)
    seen.add(entry.run_id)
    runs.push({ entry, report, reportPath, discovered: false, verification: readVerification(reportPath, entry.run_id) })
  }
  // Only runs registered in run-catalog.json are projected. Ad-hoc files under
  // reports/runs/ are unreviewed local artifacts and must never leak into the
  // public projection until the catalog (the reviewable registry) includes them.
  return runs
}

function readVerification(reportPath, runId) {
  const verificationPath = reportPath.replace(/\.report\.json$/, '.verification.json').replace(/latest-report\.json$/, 'latest-verification.json')
  if (verificationPath === reportPath || !existsSync(verificationPath)) return null
  const verification = JSON.parse(readFileSync(verificationPath, 'utf8'))
  if (verification?.run_id && verification.run_id !== runId) return null
  return verification
}

function classifyRun(run) {
  const entry = run.entry
  const isNegative = String(entry.model_id).includes('negative')
  const isFixture = entry.provider === 'fixture' || isNegative || String(entry.run_id).includes('fixture')
  let runStatus
  if (isNegative) runStatus = 'invalid'
  else if (entry.publication_status === 'candidate' && entry.archive_only) runStatus = 'archive_only'
  else if (entry.publication_status === 'locked') runStatus = 'locked'
  else if (entry.publication_status === 'promoted') runStatus = 'promoted'
  else runStatus = 'locked'
  return { isFixture, runStatus }
}

function buildRunIndexEntry(run) {
  const { isFixture, runStatus } = classifyRun(run)
  const entry = run.entry
  const verified = run.verification?.status === 'valid'
  const publishScore = !isFixture && runStatus !== 'invalid'
  return {
    id: entry.run_id,
    model_id: entry.model_id,
    model_name: modelName(entry.model_id),
    provider: entry.provider,
    suite_id: entry.suite_id,
    suite_version: entry.suite_version,
    run_status: runStatus,
    quality_score: publishScore && typeof entry.score === 'number' ? toHundred(entry.score) : null,
    coverage: typeof entry.coverage === 'number' ? entry.coverage : null,
    verified,
    is_fixture: isFixture,
    archive_only: entry.archive_only === true,
    lock_reason: entry.lock_reason || null,
    started_at: entry.started_at || null,
    completed_at: entry.finished_at || null,
    task_count: entry.task_count ?? 0,
    error_count: entry.error_count ?? 0,
    artifacts: { json: `/data/public/runs/${entry.run_id}.json` },
  }
}

function buildRunDetail(run) {
  const { isFixture, runStatus } = classifyRun(run)
  const report = run.report
  const reportRun = report.run || {}
  const summary = report.summary || {}
  const model = reportRun.model || {}
  const publicSuite = reportRun.suite_id === 'dhevals-heavy-user-ptbr'
  return sanitizeDeferredModelReferences({
    schema_version: '1.0.0',
    kind: 'dhevals_public_run',
    generated_at: GENERATED_AT,
    run: {
      id: reportRun.id,
      suite_id: reportRun.suite_id,
      suite_version: reportRun.suite_version,
      suite_hash: reportRun.suite_hash || null,
      model: {
        id: model.model_id || 'unknown',
        name: modelName(model.model_id),
        provider: model.provider || 'unknown',
      },
      runner_version: reportRun.runner_version || null,
      started_at: reportRun.started_at || null,
      finished_at: reportRun.finished_at || null,
    },
    run_status: runStatus,
    is_fixture: isFixture,
    archive_only: run.entry.archive_only === true,
    verified: run.verification?.status === 'valid',
    summary: {
      task_count: summary.task_count ?? 0,
      completed_count: summary.completed_count ?? 0,
      coverage: typeof summary.coverage === 'number' ? summary.coverage : null,
      overall_score: typeof summary.overall_score === 'number' ? toHundred(summary.overall_score) : null,
      error_count: summary.error_count ?? 0,
      estimated_cost_usd_total: typeof summary.estimated_cost_usd_total === 'number' ? summary.estimated_cost_usd_total : null,
    },
    categories: (Array.isArray(report.categories) ? report.categories : []).map((category) => ({
      category: category.category,
      task_count: category.task_count ?? 0,
      completed_count: category.completed_count ?? 0,
      error_count: category.error_count ?? 0,
      coverage: typeof category.coverage === 'number' ? category.coverage : null,
      score: typeof category.score === 'number' ? category.score : null,
      latency_ms_total: typeof category.latency_ms_total === 'number' ? category.latency_ms_total : null,
      tokens_total: typeof category.tokens_total === 'number' ? category.tokens_total : null,
    })),
    tasks: (Array.isArray(report.results) ? report.results : []).map((result) => ({
      task_id: result.task_id,
      title: result.title || null,
      category: result.category || null,
      status: result.status || null,
      score: typeof result.score === 'number' ? result.score : null,
      latency_ms: typeof result.metrics?.latency_ms === 'number' ? result.metrics.latency_ms : null,
      tokens: typeof result.metrics?.total_tokens === 'number' ? result.metrics.total_tokens : null,
      failure_reason: failureReason(result),
      prompt: publicSuite && typeof result.prompt === 'string' ? result.prompt : null,
      output: typeof result.output === 'string' ? result.output : null,
      checks: (Array.isArray(result.checks) ? result.checks : []).map((check) => ({
        id: check.id,
        type: check.type,
        passed: check.passed === true,
        score: typeof check.score === 'number' ? check.score : null,
        details: typeof check.details === 'string' ? check.details : null,
      })),
    })),
    verification: run.verification
      ? {
          status: run.verification.status || null,
          details: {
            checked: run.verification.checked || null,
            errors: Array.isArray(run.verification.errors) ? run.verification.errors : [],
            warnings: Array.isArray(run.verification.warnings) ? run.verification.warnings : [],
            verified_at: run.verification.verified_at || null,
          },
        }
      : null,
    provenance: {
      manifest_hash: reportRun.suite_hash ? `sha256:${reportRun.suite_hash}` : null,
      runner_version: reportRun.runner_version || null,
      source_report: basename(run.reportPath),
    },
  })
}

// A model response can quote internal roadmap material. Keep the archived
// evidence public while redacting deferred-model references at the projection
// boundary; source reports remain unchanged for internal auditability.
function sanitizeDeferredModelReferences(value) {
  if (typeof value === 'string') return value.replace(/sacilm/gi, 'deferred model')
  if (Array.isArray(value)) return value.map(sanitizeDeferredModelReferences)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeDeferredModelReferences(child)]))
  }
  return value
}

function buildModels(modelCatalog, runs, suiteCatalog) {
  const models = []
  const seen = new Set()
  for (const model of modelCatalog.models) {
    if (isHiddenModel(model.id)) continue
    if (!model.id || model.id.includes('fixture') || model.id.includes('negative')) continue
    seen.add(model.id)
    models.push(buildModelEntry(model.id, model.label || model.id, model.provider || 'unknown', model, runs, suiteCatalog))
  }
  for (const run of runs) {
    const modelId = run.entry.model_id
    if (isHiddenModel(modelId)) continue
    if (!modelId || seen.has(modelId)) continue
    if (modelId.includes('fixture') || modelId.includes('negative')) continue
    seen.add(modelId)
    models.push(buildModelEntry(modelId, modelId, run.entry.provider || 'unknown', null, runs, suiteCatalog))
  }
  return models
}

function buildModelEntry(id, name, provider, catalogModel, runs, suiteCatalog) {
  const modelRuns = runs.filter((run) => run.entry.model_id === id)
  const realRuns = modelRuns.filter((run) => !classifyRun(run).isFixture)
  const categories = new Set()
  for (const run of modelRuns) {
    const suite = suiteCatalog.suites.find((entry) => entry.suite_id === run.entry.suite_id && entry.version === run.entry.suite_version)
    for (const category of suite?.categories || []) categories.add(category)
  }
  const verifiedRuns = realRuns.filter((run) => run.verification?.status === 'valid')
  const latestVerified = latestBy(verifiedRuns, (run) => run.verification.verified_at)
  const latestActivity = latestBy(modelRuns, (run) => run.entry.finished_at)
  const latencies = []
  const tokens = []
  for (const run of realRuns) {
    for (const result of run.report.results || []) {
      if (typeof result.metrics?.latency_ms === 'number') latencies.push(result.metrics.latency_ms)
      if (typeof result.metrics?.total_tokens === 'number') tokens.push(result.metrics.total_tokens)
    }
  }
  const observed = latencies.length > 0 || tokens.length > 0
  const status = catalogModel?.status === 'endpoint-not-configured' ? 'not_configured' : 'calibration_pending'
  let evidenceStatus
  if (realRuns.length === 0) evidenceStatus = 'pending'
  else if (realRuns.some((run) => classifyRun(run).runStatus === 'promoted' && run.verification?.status === 'valid' && run.entry.coverage === 1)) evidenceStatus = 'supported'
  else evidenceStatus = 'locked'
  return {
    id,
    slug: slugify(id),
    name,
    provider,
    status,
    license: modelLicense(catalogModel),
    capabilities: [...categories].sort(),
    quality_score: null,
    evidence_status: EVIDENCE_STATUSES.includes(evidenceStatus) ? evidenceStatus : 'pending',
    evidence_coverage: realRuns.length ? Math.max(...realRuns.map((run) => (typeof run.entry.coverage === 'number' ? run.entry.coverage : 0))) : null,
    last_verified_at: latestVerified?.verification?.verified_at || null,
    metrics: {
      input_cost_per_1k: null,
      output_cost_per_1k: null,
      latency_ms: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      tokens_per_second: null,
      context_tokens: null,
      observed_from_runs: observed,
    },
    sources: modelSources(catalogModel, realRuns),
    notes: modelNotes(id, evidenceStatus, status, realRuns),
    last_activity_at: latestActivity?.entry?.finished_at || null,
  }
}

function buildSuites(suiteCatalog, suiteManifests) {
  return suiteCatalog.suites.map((suite) => {
    const manifest = suiteManifests.get(`${suite.suite_id}@${suite.version}`)
    const dimensions = new Set()
    for (const task of manifest.tasks || []) {
      for (const dimension of task.rubric || []) {
        if (dimension?.id) dimensions.add(dimension.id)
      }
    }
    const calibration = suite.calibration || {}
    let status
    if (suite.publication === 'fixture-only') status = 'fixture_only'
    else if (calibration.status === 'pending' || calibration.status === 'not_run') status = 'calibration_pending'
    else if (calibration.status === 'completed') status = 'calibrated'
    else status = 'calibration_pending'
    return {
      id: suite.suite_id,
      version: suite.version,
      slug: `${slugify(suite.suite_id.replace(/^dhevals-/, ''))}-v${suite.version.replace(/\./g, '-')}`,
      title: SUITE_TITLE,
      language: suite.locale || 'pt-BR',
      task_count: suite.task_count ?? (manifest.tasks || []).length,
      categories: Array.isArray(suite.categories) ? suite.categories : [],
      dimension_count: dimensions.size,
      status,
      manifest_hash: suite.content_hash ? `sha256:${suite.content_hash}` : null,
      last_reviewed_at: null,
      current_public: suite.current_public === true,
      description: typeof manifest.description === 'string' ? manifest.description : null,
      license: typeof manifest.license === 'string' ? manifest.license : null,
      calibration: {
        status: calibration.status || 'not_run',
        completed_groups: calibration.completed_groups ?? 0,
        required_groups: calibration.required_groups ?? 0,
      },
    }
  })
}

function buildOverview(runCatalog, runs, suiteCatalog, modelEntries, sourceRevision) {
  const currentRunId = runCatalog.current_public_run_id
  const current = runs.find((run) => run.entry.run_id === currentRunId) || latestBy(runs, (run) => run.entry.finished_at)
  const currentSuite = current
    ? suiteCatalog.suites.find((suite) => suite.suite_id === current.entry.suite_id && suite.version === current.entry.suite_version)
    : suiteCatalog.suites.find((suite) => suite.current_public) || null
  const calibration = currentSuite?.calibration || {}
  const promoted = runs.filter((run) => classifyRun(run).runStatus === 'promoted')
  const currentClassification = current ? classifyRun(current) : null
  const currentIsLocked = currentClassification
    ? currentClassification.isFixture || currentClassification.runStatus !== 'promoted'
    : false
  return {
    schema_version: '1.0.0',
    kind: 'dhevals_public_overview',
    generated_at: GENERATED_AT,
    source_revision: sourceRevision,
    latest_signal: current
      ? {
          run_id: current.entry.run_id,
          model_id: current.entry.model_id,
          model_name: modelName(current.entry.model_id),
          provider: current.entry.provider,
          suite_id: current.entry.suite_id,
          suite_version: current.entry.suite_version,
          score: currentIsLocked ? null : toHundred(current.entry.score),
          coverage: typeof current.entry.coverage === 'number' ? current.entry.coverage : null,
          evidence_status: currentIsLocked ? 'locked' : 'supported',
          is_fixture: classifyRun(current).isFixture,
          date: current.entry.finished_at || null,
        }
      : null,
    calibration: {
      status: calibration.status || 'pending',
      completed_groups: calibration.completed_groups ?? 0,
      required_groups: calibration.required_groups ?? 0,
    },
    counts: {
      suites: suiteCatalog.suites.length,
      models: modelEntries.length,
      runs: runs.length,
      promoted_runs: promoted.length,
    },
    methodology_version: METHODOLOGY_VERSION,
  }
}

function buildLeaderboard(modelEntries, runs) {
  const notRanked = modelEntries.map((model) => ({
    model_id: model.id,
    model_name: model.name,
    provider: model.provider,
    reason: model.status === 'not_configured' ? 'not_configured' : model.evidence_status === 'locked' ? 'locked' : 'pending',
    evidence_status: model.evidence_status,
    last_activity_at: model.last_activity_at,
  }))
  return {
    schema_version: '1.0.0',
    kind: 'dhevals_public_leaderboard',
    generated_at: GENERATED_AT,
    methodology: {
      ranking_field: 'quality_score',
      requires_full_coverage: true,
      requires_promotion: true,
      fixture_scores_never_published: true,
    },
    ranked: [],
    not_ranked: notRanked,
  }
}

function buildCatalogCsv(runEntries) {
  const header = 'run_id,model_id,suite_version,run_status,quality_score,coverage,verified,completed_at'
  const rows = runEntries.map((entry) => [
    entry.id,
    entry.model_id,
    entry.suite_version,
    entry.run_status,
    entry.quality_score ?? '',
    entry.coverage ?? '',
    entry.verified,
    entry.completed_at ?? '',
  ].map(csvCell).join(','))
  return `${[header, ...rows].join('\n')}\n`
}

function csvCell(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function modelName(modelId) {
  if (modelId === 'sacilm') return 'SaciLM'
  if (modelId === 'baseline-gpt-4-turbo') return 'GPT-4 Turbo baseline'
  return modelId || 'unknown'
}

function isHiddenModel(modelId) {
  return String(modelId || '').toLowerCase().includes('sacilm')
}

function modelLicense(catalogModel) {
  if (!catalogModel?.manifest) return 'unknown'
  const manifestPath = resolve(root, catalogModel.manifest)
  if (!existsSync(manifestPath)) return 'unknown'
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const license = manifest?.base_model?.license
  if (license === 'open' || license === 'closed') return license
  return 'unknown'
}

function modelSources(catalogModel, realRuns) {
  const sources = []
  if (catalogModel?.manifest) sources.push(catalogModel.manifest)
  for (const run of realRuns) sources.push(run.entry.source)
  return [...new Set(sources)]
}

function modelNotes(id, evidenceStatus, status, realRuns) {
  if (status === 'not_configured') return 'Endpoint not configured; comparison baseline only, no runs executed.'
  if (evidenceStatus === 'locked') return 'Archive-only runs exist, but the promotion gate is closed; no promoted public score yet.'
  if (realRuns.length === 0) return 'Calibration in progress; no promoted public score yet.'
  return 'Calibration in progress; no promoted public score yet.'
}

function failureReason(result) {
  if (!result.error) return null
  if (typeof result.error === 'string') return result.error
  if (typeof result.error.message === 'string') return result.error.message
  return 'task error'
}

function latestBy(items, pick) {
  let best = null
  let bestTime = 0
  for (const item of items) {
    const time = Date.parse(pick(item) || '') || 0
    if (time >= bestTime) {
      best = item
      bestTime = time
    }
  }
  return best
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function toHundred(score) {
  return typeof score === 'number' ? Math.round(score * 1000) / 10 : null
}

function readRequiredJson(path) {
  if (!existsSync(path)) fail(`required source file is missing: ${path}`)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    fail(`required source file is malformed: ${path}`)
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function fail(message) {
  console.error(JSON.stringify({ status: 'error', kind: 'dhevals_public_projection_build', message }, null, 2))
  process.exit(1)
}
