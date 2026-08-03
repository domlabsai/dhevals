import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const report = resolve(root, process.env.DHEVALS_SCORECARD_REPORT || 'public/data/latest-report.json')
const output = resolve(root, process.env.DHEVALS_SCORECARD_OUTPUT || 'public/data/latest-scorecard.json')
if (!existsSync(report)) {
  console.error(`Cannot build scorecard: report not found at ${report}`)
  process.exit(2)
}

const args = [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-scorecard',
  '--report', report,
  '--output', output,
]
const optional = [
  ['DHEVALS_SCORECARD_CALIBRATION', 'calibration'],
  ['DHEVALS_SCORECARD_SAFETY', 'safety'],
  ['DHEVALS_SCORECARD_AGENT', 'agent'],
  ['DHEVALS_SCORECARD_JUDGE', 'judge'],
]
for (const [envName, flag] of optional) {
  const candidate = process.env[envName] ? resolve(root, process.env[envName]) : resolve(root, `public/data/latest-${flag}.json`)
  if (existsSync(candidate)) args.push(`--${flag}`, candidate)
}

const command = spawnSync('uv', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(command.stdout || '')
process.stderr.write(command.stderr || '')
if (command.status !== 0) process.exit(command.status ?? 1)
