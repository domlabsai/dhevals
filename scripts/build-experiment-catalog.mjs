import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const output = resolve(root, process.env.DHEVALS_EXPERIMENT_CATALOG_OUTPUT || 'public/data/experiment-catalog.json')
const candidates = []
const publicReport = resolve(root, 'public/data/latest-report.json')
if (existsSync(publicReport)) candidates.push(publicReport)
for (const directory of ['reports/fixtures', 'reports/runs', 'reports/comparisons']) {
  const absolute = resolve(root, directory)
  if (existsSync(absolute)) walk(absolute, candidates)
}

const byRun = new Map()
for (const path of candidates) {
  if (!path.endsWith('.json') || path.endsWith('.verification.json') || path.endsWith('.youtube.json')) continue
  const report = safeJson(path)
  if (report?.kind !== 'dhevals_report' || !report.run?.id) continue
  const entry = toExperiment(report, path)
  const existing = byRun.get(entry.run_id)
  if (!existing || path === publicReport) byRun.set(entry.run_id, entry)
}

const entries = [...byRun.values()].sort((left, right) => {
  const rightTime = Date.parse(right.finished_at || right.generated_at || '') || 0
  const leftTime = Date.parse(left.finished_at || left.generated_at || '') || 0
  return rightTime - leftTime || left.run_id.localeCompare(right.run_id)
})
const catalog = {
  kind: 'dhevals_experiment_catalog',
  schema_version: '0.1.0',
  generated_at: new Date().toISOString(),
  status: entries.length ? 'ready' : 'empty',
  entries,
}
mkdirSync(resolve(output, '..'), { recursive: true })
writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output, status: catalog.status, experiments: entries.length }, null, 2))

function toExperiment(report, path) {
  const run = report.run || {}
  const model = run.model || {}
  const summary = report.summary || {}
  const modelExtra = model.extra && typeof model.extra === 'object' ? model.extra : {}
  const reportHash = sha256Json(report)
  const provider = model.provider || 'unknown'
  return {
    experiment_id: `dhevals:${run.suite_id || 'suite'}:${run.suite_version || 'version'}:${model.model_id || 'model'}:${run.id}`,
    run_id: run.id,
    status: summary.error_count ? 'completed_with_errors' : summary.coverage === 1 ? 'completed' : 'incomplete',
    model: {
      id: model.model_id || 'unknown',
      provider,
      checkpoint: stringOrNull(modelExtra.checkpoint),
      runtime: stringOrNull(modelExtra.runtime),
      training_commit: stringOrNull(modelExtra.training_commit),
    },
    suite: {
      id: run.suite_id || null,
      version: run.suite_version || null,
      hash: run.suite_hash || null,
    },
    configuration: {
      temperature: model.temperature ?? null,
      max_tokens: model.max_tokens ?? null,
      seed: model.seed ?? null,
    },
    metrics: {
      task_count: summary.task_count ?? 0,
      completed_count: summary.completed_count ?? 0,
      coverage: summary.coverage ?? null,
      quality_score: summary.overall_score ?? null,
      error_count: summary.error_count ?? 0,
      estimated_cost_usd: summary.estimated_cost_usd_total ?? null,
    },
    artifact: {
      report: relative(root, path),
      report_hash: reportHash,
      generated_at: report.generated_at || null,
    },
    started_at: run.started_at || null,
    finished_at: run.finished_at || null,
    publication: provider === 'fixture' ? 'locked_fixture' : 'candidate',
  }
}

function walk(directory, paths) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) walk(path, paths)
    else if (entry.isFile()) paths.push(path)
  }
}

function safeJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(sortKeys(value)), 'utf8').digest('hex')
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
  return value
}
