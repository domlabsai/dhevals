import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const output = resolve(root, process.env.DHEVALS_RELEASE_GATE_OUTPUT || 'reports/release/latest.json')
const publicOutput = resolve(root, process.env.DHEVALS_RELEASE_GATE_PUBLIC_OUTPUT || 'public/data/latest-release-gate.json')
const paths = {
  run: process.env.DHEVALS_RELEASE_RUN || 'public/data/latest-run.json',
  suite: process.env.DHEVALS_RELEASE_SUITE || 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json',
  report: process.env.DHEVALS_RELEASE_REPORT || 'public/data/latest-report.json',
  verification: process.env.DHEVALS_RELEASE_VERIFICATION || 'public/data/latest-verification.json',
  audit: process.env.DHEVALS_RELEASE_AUDIT || 'public/data/latest-audit.json',
  calibration: process.env.DHEVALS_RELEASE_CALIBRATION || 'public/data/latest-calibration.json',
  leaderboard: process.env.DHEVALS_RELEASE_LEADERBOARD || 'public/data/leaderboard.json',
}

mkdirSync(resolve(root, 'reports/release'), { recursive: true })
mkdirSync(resolve(root, 'public/data'), { recursive: true })
const args = [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-release-gate',
  '--run', paths.run,
  '--suite', paths.suite,
  '--report', paths.report,
  '--verification', paths.verification,
  '--audit', paths.audit,
  '--calibration', paths.calibration,
  '--leaderboard', paths.leaderboard,
  '--output', output,
]
const command = spawnSync('uv', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(command.stdout || '')
process.stderr.write(command.stderr || '')
if (!existsSync(output)) {
  console.error(`Release gate did not write ${output}`)
  process.exit(command.status ?? 2)
}
copyFileSync(output, publicOutput)
const gate = JSON.parse(readFileSync(output, 'utf8'))
console.log(JSON.stringify({ output, public_output: publicOutput, status: gate.status, errors: gate.errors.length }, null, 2))

// The dashboard must be able to display a blocked gate. Strict CI callers can
// use `npm run check:release`, which preserves the non-zero status.
if (process.env.DHEVALS_RELEASE_GATE_STRICT === '1' && command.status !== 0) process.exit(command.status ?? 2)
