import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const reportDirectories = (process.env.DHEVALS_LEADERBOARD_REPORT_DIRS
  ? process.env.DHEVALS_LEADERBOARD_REPORT_DIRS.split(',').map((directory) => directory.trim()).filter(Boolean)
  : ['reports/fixtures', 'reports/runs'])
  .map((directory) => resolve(root, directory))
const calibrationSummary = resolve(root, process.env.DHEVALS_CALIBRATION_SUMMARY || 'reports/calibration/heavy-user-ptbr-v0.2-summary.json')
const suitePath = resolve(root, process.env.DHEVALS_LEADERBOARD_SUITE || 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json')
const outputPath = process.env.DHEVALS_LEADERBOARD_OUTPUT || 'public/data/leaderboard.json'
const suiteManifest = JSON.parse(readFileSync(suitePath, 'utf8'))
const targetSuite = { id: suiteManifest.id, version: suiteManifest.version, hash: sha256Json(suiteManifest) }
const candidateInputs = reportDirectories.flatMap((directory) => {
  if (!existsSync(directory)) return []
  return readdirSync(directory).filter((file) => file.endsWith('.report.json')).map((file) => resolve(directory, file))
})
const matchingInputs = candidateInputs.filter((input) => {
  try {
    const report = JSON.parse(readFileSync(input, 'utf8'))
    const run = report?.run || {}
    const matches = run.suite_id === targetSuite.id && run.suite_version === targetSuite.version && run.suite_hash === targetSuite.hash
    if (!matches) console.warn(`Skipping ${input}: suite identity/hash does not match ${targetSuite.id}@${targetSuite.version}`)
    return matches
  } catch (error) {
    console.warn(`Skipping ${input}: invalid report (${error.message})`)
    return false
  }
})

// Fixtures remain available for offline diagnostics, but they must not become
// entries in the public leaderboard once a real candidate exists. If the
// repository only contains fixtures, retain them so the console can still
// render the intentionally locked development board.
const nonFixtureInputs = matchingInputs.filter((input) => {
  try {
    const report = JSON.parse(readFileSync(input, 'utf8'))
    return report?.run?.model?.provider !== 'fixture'
  } catch {
    return false
  }
})
const inputs = nonFixtureInputs.length ? nonFixtureInputs : matchingInputs

if (!inputs.length) {
  console.error('No canonical report artifacts found; run a fixture or model evaluation first.')
  process.exit(2)
}

const args = [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-leaderboard',
  '--output', outputPath,
]
if (existsSync(calibrationSummary)) args.push('--calibration-summary', calibrationSummary)
for (const input of inputs) args.push('--input', input)
const command = spawnSync('uv', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(command.stdout || '')
process.stderr.write(command.stderr || '')
if (command.status !== 0) process.exit(command.status ?? 1)

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(sortKeys(value)), 'utf8').digest('hex')
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
  return value
}
