import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suite = 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json'
const fixture = process.env.DHEVALS_V03_FIXTURE || 'benchmarks/suites/heavy-user-ptbr/v0.3/fixtures/sacilm-calibration-fixture.json'
const outputStem = process.env.DHEVALS_V03_OUTPUT_STEM || 'sacilm-heavy-user-expanded-v0.3'
const output = resolve(root, 'reports/fixtures', `${outputStem}.json`)
const report = resolve(root, 'reports/fixtures', `${outputStem}.report.json`)
const youtube = resolve(root, 'reports/fixtures', `${outputStem}.youtube.json`)
const html = resolve(root, 'reports/fixtures', `${outputStem}.html`)
const csv = resolve(root, 'reports/fixtures', `${outputStem}.csv`)
const verification = resolve(root, 'reports/fixtures', `${outputStem}.verification.json`)
const modelId = process.env.DHEVALS_V03_MODEL_ID || 'sacilm-expanded-fixture'
const checkpoint = process.env.DHEVALS_V03_CHECKPOINT || 'calibration-fixture-v0.3'
const trainingCommit = process.env.DHEVALS_V03_TRAINING_COMMIT || 'calibration-v0.3'
const runId = process.env.DHEVALS_V03_RUN_ID || 'expanded-fixture-v0.3'

const audit = spawnSync(process.execPath, ['scripts/audit-heavy-user-v03.mjs'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(audit.stdout || '')
process.stderr.write(audit.stderr || '')
if (audit.status !== 0) process.exit(audit.status ?? 1)

mkdirSync(resolve(root, 'reports/fixtures'), { recursive: true })
const run = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-run',
  '--suite', suite,
  '--fixture', fixture,
  '--model-id', modelId,
  '--checkpoint', checkpoint,
  '--runtime', 'offline-fixture',
  '--training-commit', trainingCommit,
  '--run-id', runId,
  '--output', output,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(run.stdout || '')
process.stderr.write(run.stderr || '')
if (run.status !== 0) process.exit(run.status ?? 1)

const verify = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-verify',
  '--artifact', output, '--suite', resolve(root, suite), '--output', verification,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(verify.stdout || '')
process.stderr.write(verify.stderr || '')
if (verify.status !== 0) process.exit(verify.status ?? 1)

const reportRun = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-report',
  '--input', output, '--report-output', report, '--youtube-output', youtube,
  '--html-output', html, '--csv-output', csv,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(reportRun.stdout || '')
process.stderr.write(reportRun.stderr || '')
if (reportRun.status !== 0) process.exit(reportRun.status ?? 1)

const reportVerify = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-verify',
  '--artifact', output, '--suite', resolve(root, suite), '--report', report, '--output', verification,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(reportVerify.stdout || '')
process.stderr.write(reportVerify.stderr || '')
if (reportVerify.status !== 0) process.exit(reportVerify.status ?? 1)

if (!existsSync(report) || !existsSync(csv) || !existsSync(youtube)) process.exit(2)
const catalog = spawnSync(process.execPath, ['scripts/build-run-catalog.mjs'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(catalog.stdout || '')
process.stderr.write(catalog.stderr || '')
if (catalog.status !== 0) process.exit(catalog.status ?? 1)
const testMatrix = spawnSync(process.execPath, ['scripts/build-test-matrix.mjs', 'build'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(testMatrix.stdout || '')
process.stderr.write(testMatrix.stderr || '')
if (testMatrix.status !== 0) process.exit(testMatrix.status ?? 1)
for (const script of ['scripts/build-dataset-catalog.mjs', 'scripts/build-experiment-catalog.mjs', 'scripts/build-comparison-execution.mjs']) {
  const derived = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(derived.stdout || '')
  process.stderr.write(derived.stderr || '')
  if (derived.status !== 0) process.exit(derived.status ?? 1)
}
console.log(JSON.stringify({ output, report, youtube, html, csv, verification, status: 'ready' }, null, 2))
