import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suitesRoot = resolve(root, 'benchmarks/suites/heavy-user-ptbr')
const output = resolve(root, process.env.DHEVALS_SUITE_CATALOG_OUTPUT || 'public/data/suite-catalog.json')
const auditMap = {
  '0.2.0': 'reports/audits/heavy-user-ptbr-v0.2.json',
  '0.3.0': 'reports/audits/heavy-user-ptbr-v0.3.json',
}
const calibrationMap = {
  '0.2.0': 'public/data/latest-calibration.json',
  '0.3.0': 'reports/calibration/heavy-user-ptbr-v0.3-progress.json',
}

const entries = []
for (const directory of readdirSync(suitesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))) {
  const suitePath = resolve(suitesRoot, directory.name, 'suite.json')
  if (!existsSync(suitePath)) continue
  const suite = readJson(suitePath)
  const hash = sha256Json(suite)
  const auditPath = auditMap[suite.version]
  const calibrationPath = calibrationMap[suite.version]
  const audit = auditPath && existsSync(resolve(root, auditPath)) ? readJson(resolve(root, auditPath)) : null
  const calibration = calibrationPath && existsSync(resolve(root, calibrationPath)) ? readJson(resolve(root, calibrationPath)) : null
  entries.push({
    suite_id: suite.id,
    version: suite.version,
    locale: suite.locale,
    task_count: Array.isArray(suite.tasks) ? suite.tasks.length : 0,
    categories: [...new Set((suite.tasks || []).map((task) => task.category))],
    content_hash: hash,
    manifest: relative(root, suitePath),
    publication: suite.provenance?.publication || 'unknown',
    audit: audit ? { status: audit.status, path: auditPath, anchor_groups: audit.checks?.rubric?.required_anchor_groups ?? null } : { status: 'not_run', path: auditPath || null, anchor_groups: null },
    calibration: calibration ? { status: calibration.status, completed_groups: calibration.completed_groups ?? 0, required_groups: calibration.required_groups ?? 0, path: calibrationPath } : { status: 'not_run', completed_groups: 0, required_groups: 0, path: calibrationPath || null },
    current_public: suite.version === '0.2.0',
  })
}

const catalog = {
  kind: 'dhevals_suite_catalog',
  schema_version: '0.1.0',
  generated_at: new Date().toISOString(),
  suites: entries,
}
mkdirSync(resolve(output, '..'), { recursive: true })
writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output, suites: entries.length, versions: entries.map((entry) => entry.version) }, null, 2))

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(sortKeys(value)), 'utf8').digest('hex')
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
  return value
}
