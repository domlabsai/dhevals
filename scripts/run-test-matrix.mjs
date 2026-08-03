import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const versions = (process.env.DHEVALS_TEST_MATRIX_EXECUTION_VERSIONS || 'v0.2,v0.3')
  .split(',').map((value) => value.trim()).filter(Boolean)
const output = resolve(root, process.env.DHEVALS_TEST_MATRIX_EXECUTION_OUTPUT || 'public/data/test-execution-latest.json')
const workspace = mkdtempSync(resolve(tmpdir(), 'dhevals-matrix-'))
const entries = []

for (const versionDirectory of versions) {
  const suitePath = resolve(root, `benchmarks/suites/heavy-user-ptbr/${versionDirectory}/suite.json`)
  const positiveFixturePath = resolve(root, `benchmarks/suites/heavy-user-ptbr/${versionDirectory}/fixtures/sacilm-calibration-fixture.json`)
  const negativeFixturePath = resolve(root, `benchmarks/suites/heavy-user-ptbr/${versionDirectory}/fixtures/negative-fixture.json`)
  const matrixPath = resolve(root, `benchmarks/tests/heavy-user-ptbr/${versionDirectory}/test-matrix.json`)
  for (const path of [suitePath, positiveFixturePath, negativeFixturePath, matrixPath]) {
    if (!existsSync(path)) throw new Error(`matrix execution source not found: ${path}`)
  }
  const suite = readJson(suitePath)
  const matrix = readJson(matrixPath)
  const positive = executeScenario({ versionDirectory, scenario: 'positive', suitePath, fixturePath: positiveFixturePath, workspace })
  const negative = executeScenario({ versionDirectory, scenario: 'negative', suitePath, fixturePath: negativeFixturePath, workspace })
  assertPositive(positive, versionDirectory)
  assertNegative(negative, versionDirectory)
  if (matrix.sources?.hashes?.suite !== sha256Json(suite)) throw new Error(`${versionDirectory}: test matrix suite hash drift`)
  entries.push({
    suite_id: suite.id,
    suite_version: suite.version,
    suite_hash: sha256Json(suite),
    matrix: {
      path: relativePath(matrixPath),
      task_count: matrix.coverage?.task_count ?? suite.tasks?.length ?? 0,
      scenario_count: matrix.coverage?.scenario_count ?? 0,
      anchor_group_count: matrix.coverage?.anchor_group_count ?? 0,
      scorecard_dimension_count: matrix.coverage?.scorecard_dimension_count ?? matrix.scorecard_coverage?.length ?? 0,
      scorecard_dimensions: (matrix.scorecard_coverage || []).map((entry) => ({ dimension: entry.dimension, status: entry.status })),
    },
    scenarios: { positive, negative },
    adapters: ['fixture'],
    status: 'ready',
  })
}

const artifact = {
  kind: 'dhevals_test_execution',
  schema_version: '0.1.0',
  status: 'ready',
  generated_at: new Date().toISOString(),
  purpose: 'offline contract execution for every versioned heavy-user matrix',
  entries,
  coverage: {
    version_count: entries.length,
    scenario_count: entries.reduce((sum, entry) => sum + Object.keys(entry.scenarios).length, 0),
    task_count: entries.reduce((sum, entry) => sum + (entry.matrix.task_count || 0), 0),
    scorecard_dimension_count: Math.max(...entries.map((entry) => entry.matrix.scorecard_dimension_count || 0), 0),
  },
  provenance: { runner: 'dhevals-run', verification: 'dhevals-verify', report: 'dhevals-report' },
}
mkdirSync(resolve(output, '..'), { recursive: true })
writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output, status: artifact.status, versions: entries.length, scenarios: artifact.coverage.scenario_count }, null, 2))

function executeScenario({ versionDirectory, scenario, suitePath, fixturePath, workspace }) {
  const stem = `${versionDirectory}-${scenario}`
  const runPath = resolve(workspace, `${stem}.run.json`)
  const verificationPath = resolve(workspace, `${stem}.verification.json`)
  const reportPath = resolve(workspace, `${stem}.report.json`)
  const youtubePath = resolve(workspace, `${stem}.youtube.json`)
  const htmlPath = resolve(workspace, `${stem}.html`)
  const csvPath = resolve(workspace, `${stem}.csv`)
  const runId = `matrix-${versionDirectory}-${scenario}`
  runUv([
    'dhevals-run', '--suite', relativePath(suitePath), '--fixture', relativePath(fixturePath),
    '--model-id', 'sacilm-matrix-fixture', '--checkpoint', `matrix-fixture-${versionDirectory}`,
    '--runtime', 'offline-fixture', '--training-commit', `test-matrix-${versionDirectory}`,
    '--run-id', runId, '--output', runPath,
  ], `run ${stem}`)
  runUv(['dhevals-report', '--input', runPath, '--report-output', reportPath, '--youtube-output', youtubePath, '--html-output', htmlPath, '--csv-output', csvPath], `report ${stem}`)
  runUv(['dhevals-verify', '--artifact', runPath, '--suite', relativePath(suitePath), '--report', reportPath, '--output', verificationPath], `verify ${stem}`)
  const run = readJson(runPath)
  const report = readJson(reportPath)
  const verification = readJson(verificationPath)
  return {
    run_id: run.run?.id,
    status: verification.status === 'valid' ? 'verified' : 'invalid',
    coverage: run.summary?.coverage ?? null,
    score: run.summary?.overall_score ?? null,
    completed_count: run.summary?.completed_count ?? null,
    task_count: run.summary?.task_count ?? null,
    error_count: run.summary?.error_count ?? 0,
    result_statuses: [...new Set((run.results || []).map((result) => result.status))].sort(),
    report_kind: report.kind,
    verification_kind: verification.kind,
    artifacts: {
      report: `temporary/${stem}.report.json`,
      verification: `temporary/${stem}.verification.json`,
    },
  }
}

function assertPositive(result, versionDirectory) {
  if (result.status !== 'verified' || result.coverage !== 1 || result.score !== 1 || result.error_count !== 0) {
    throw new Error(`${versionDirectory} positive scenario did not meet full-pass contract`)
  }
  if (result.result_statuses.some((status) => status !== 'pass')) throw new Error(`${versionDirectory} positive scenario contains non-pass result`)
}

function assertNegative(result, versionDirectory) {
  if (result.status !== 'verified' || result.coverage !== 1 || result.error_count !== 0 || !(typeof result.score === 'number' && result.score < 1)) {
    throw new Error(`${versionDirectory} negative scenario did not expose a quality failure safely`)
  }
  if (!result.result_statuses.some((status) => status === 'fail' || status === 'partial')) throw new Error(`${versionDirectory} negative scenario did not contain a quality failure`)
}

function runUv(args, label) {
  const command = spawnSync('uv', ['run', '--python', '3.12', '--project', 'packages/dhevals_core', ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  if (command.status !== 0) {
    process.stderr.write(command.stdout || '')
    process.stderr.write(command.stderr || '')
    throw new Error(`${label} failed with status ${command.status}`)
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function relativePath(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(sortKeys(value)), 'utf8').digest('hex')
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
  return value
}
