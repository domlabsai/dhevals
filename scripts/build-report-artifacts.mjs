import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const command = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-report',
  '--input', 'public/data/latest-run.json',
  '--report-output', 'public/data/latest-report.json',
  '--youtube-output', 'public/data/latest-youtube-pack.json',
  '--html-output', 'public/data/latest-report.html',
  '--csv-output', 'public/data/latest-results.csv',
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })

process.stdout.write(command.stdout || '')
process.stderr.write(command.stderr || '')
if (command.status !== 0) process.exit(command.status ?? 1)

const scorecard = spawnSync(process.execPath, ['scripts/build-scorecard.mjs'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(scorecard.stdout || '')
process.stderr.write(scorecard.stderr || '')
if (scorecard.status !== 0) process.exit(scorecard.status ?? 1)
