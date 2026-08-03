import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const output = resolve(root, process.env.DHEVALS_RUN_CATALOG_OUTPUT || 'public/data/run-catalog.json')
const publicReportPath = resolve(root, 'public/data/latest-report.json')
const leaderboardPath = resolve(root, 'public/data/leaderboard.json')
const reportPaths = []
if (existsSync(publicReportPath)) reportPaths.push(publicReportPath)
const reportsRoot = resolve(root, 'reports')
if (existsSync(reportsRoot)) walk(reportsRoot, reportPaths)

const publicReport = existsSync(publicReportPath) ? readJson(publicReportPath) : null
const publicRunId = publicReport?.run?.id || null
const leaderboard = existsSync(leaderboardPath) ? readJson(leaderboardPath) : { entries: [] }
const leaderboardByRun = new Map((leaderboard.entries || []).filter((entry) => entry?.run_id).map((entry) => [entry.run_id, entry]))
const byRunId = new Map()
for (const reportPath of reportPaths) {
  if (reportPath !== publicReportPath && !reportPath.endsWith('.report.json')) continue
  const report = safeReadJson(reportPath)
  const run = report?.run
  if (!run?.id || !run?.suite_id || !run?.suite_version) continue
  const isPublicSource = reportPath === publicReportPath
  const entry = buildEntry(report, reportPath, leaderboardByRun.get(run.id), run.id === publicRunId)
  const existing = byRunId.get(run.id)
  if (!existing || isPublicSource || (entry.current_public && !existing.current_public)) byRunId.set(run.id, entry)
}

const entries = [...byRunId.values()].sort((left, right) => {
  const rightTime = Date.parse(right.finished_at || right.generated_at || '') || 0
  const leftTime = Date.parse(left.finished_at || left.generated_at || '') || 0
  return rightTime - leftTime || left.run_id.localeCompare(right.run_id)
})
const catalog = {
  kind: 'dhevals_run_catalog',
  schema_version: '0.1.0',
  generated_at: new Date().toISOString(),
  current_public_run_id: publicRunId,
  entries,
}
mkdirSync(resolve(output, '..'), { recursive: true })
writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output, entries: entries.length, current_public_run_id: publicRunId }, null, 2))

function buildEntry(report, reportPath, leaderboardEntry, currentPublic) {
  const run = report.run || {}
  const model = run.model || {}
  const summary = report.summary || {}
  const provider = model.provider || 'unknown'
  const fixture = provider === 'fixture'
  const publicationStatus = leaderboardEntry?.publication_status || (fixture ? 'locked' : 'candidate')
  return {
    run_id: run.id,
    suite_id: run.suite_id,
    suite_version: run.suite_version,
    suite_hash: run.suite_hash || null,
    model_id: model.model_id || 'unknown',
    provider,
    score: typeof summary.overall_score === 'number' ? summary.overall_score : null,
    coverage: typeof summary.coverage === 'number' ? summary.coverage : null,
    task_count: summary.task_count ?? 0,
    completed_count: summary.completed_count ?? 0,
    error_count: summary.error_count ?? 0,
    started_at: run.started_at || null,
    finished_at: run.finished_at || null,
    generated_at: report.generated_at || null,
    source: relative(root, reportPath),
    current_public: currentPublic,
    archive_only: !currentPublic && reportPath.includes(`${separator()}reports${separator()}runs${separator()}`),
    publication_status: publicationStatus,
    lock_reason: leaderboardEntry?.lock_reason || (fixture ? 'offline fixture' : null),
  }
}

function walk(directory, outputPaths) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) walk(path, outputPaths)
    else if (entry.isFile() && entry.name.endsWith('.report.json')) outputPaths.push(path)
  }
}

function separator() {
  return process.platform === 'win32' ? '\\' : '/'
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function safeReadJson(path) {
  try { return readJson(path) } catch { return null }
}
