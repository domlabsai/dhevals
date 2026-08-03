import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const versionDirectory = process.env.DHEVALS_CALIBRATION_VERSION || 'v0.3'
const version = versionDirectory.replace(/^v/, '')
const base = `benchmarks/calibration/heavy-user-ptbr/${versionDirectory}`
const packDirectory = process.env.DHEVALS_CALIBRATION_BLIND_DIR || `reports/calibration/heavy-user-ptbr-${versionDirectory}-blind`
const packPath = process.env.DHEVALS_CALIBRATION_PACK || `${packDirectory}/pack.json`
const rubricPath = process.env.DHEVALS_CALIBRATION_RUBRIC || `${base}/anchor-rubric.json`
const responsesPath = process.env.DHEVALS_CALIBRATION_RESPONSES || `${base}/responses-reviewed.json`
const summaryPath = process.env.DHEVALS_CALIBRATION_SUMMARY || `reports/calibration/heavy-user-ptbr-${versionDirectory}-summary.json`
const progressPath = process.env.DHEVALS_CALIBRATION_PROGRESS_OUTPUT || `public/data/calibration/${versionDirectory}/progress.json`
const examplesPath = process.env.DHEVALS_CALIBRATION_EXAMPLES || `${base}/anchor-examples.json`
const sharedSheetPath = process.env.DHEVALS_CALIBRATION_SHARED_SHEET || `reports/calibration/heavy-user-ptbr-${versionDirectory}-review.csv`
const adjudicationSheet = process.env.DHEVALS_CALIBRATION_ADJUDICATIONS
const adjudicationsOutput = process.env.DHEVALS_CALIBRATION_ADJUDICATIONS_OUTPUT || `reports/calibration/heavy-user-ptbr-${versionDirectory}-adjudications.json`
const sheets = [
  process.env.DHEVALS_CALIBRATION_REVIEWER_A || `${packDirectory}/reviewer-a.csv`,
  process.env.DHEVALS_CALIBRATION_REVIEWER_B || `${packDirectory}/reviewer-b.csv`,
]

for (const path of [packPath, rubricPath, ...sheets, ...(adjudicationSheet ? [adjudicationSheet] : [])]) {
  if (!existsSync(resolve(root, path))) {
    console.error(`Calibration input not found: ${path}`)
    process.exit(2)
  }
}

mkdirSync(resolve(root, 'reports/calibration'), { recursive: true })
const importCommand = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-calibration-sheet', 'import-blind',
  '--sheet', sheets[0], '--sheet', sheets[1], '--rubric', rubricPath, '--pack', packPath, '--output', responsesPath,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(importCommand.stdout || '')
process.stderr.write(importCommand.stderr || '')
if (importCommand.status !== 0) process.exit(importCommand.status ?? 2)

if (adjudicationSheet) {
  const adjudicationCommand = spawnSync('uv', [
    'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-calibration-sheet', 'import-adjudication',
    '--sheet', adjudicationSheet, '--rubric', rubricPath, '--output', adjudicationsOutput,
  ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(adjudicationCommand.stdout || '')
  process.stderr.write(adjudicationCommand.stderr || '')
  if (adjudicationCommand.status !== 0) process.exit(adjudicationCommand.status ?? 2)
  const responsesPayload = JSON.parse(readFileSync(resolve(root, responsesPath), 'utf8'))
  const adjudicationsPayload = JSON.parse(readFileSync(resolve(root, adjudicationsOutput), 'utf8'))
  responsesPayload.adjudications = Array.isArray(adjudicationsPayload.adjudications) ? adjudicationsPayload.adjudications : []
  writeFileSync(resolve(root, responsesPath), `${JSON.stringify(responsesPayload, null, 2)}\n`, 'utf8')
}

const calibrationCommand = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-calibration',
  '--rubric', rubricPath, '--responses', responsesPath, '--output', summaryPath,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(calibrationCommand.stdout || '')
process.stderr.write(calibrationCommand.stderr || '')
if (!existsSync(resolve(root, summaryPath))) {
  console.error(`Calibration summary was not written: ${summaryPath}`)
  process.exit(calibrationCommand.status ?? 2)
}

const progressCommand = spawnSync(process.execPath, ['scripts/build-calibration-progress.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
  env: {
    ...process.env,
    DHEVALS_CALIBRATION_SUMMARY: summaryPath,
    DHEVALS_CALIBRATION_RESPONSES: responsesPath,
    DHEVALS_CALIBRATION_RUBRIC: rubricPath,
    DHEVALS_CALIBRATION_EXAMPLES: examplesPath,
    DHEVALS_CALIBRATION_SHARED_SHEET: sharedSheetPath,
    DHEVALS_CALIBRATION_BLIND_DIR: packDirectory,
    DHEVALS_CALIBRATION_PACK: packPath,
    DHEVALS_CALIBRATION_PROGRESS_OUTPUT: progressPath,
  },
})
process.stdout.write(progressCommand.stdout || '')
process.stderr.write(progressCommand.stderr || '')
if (progressCommand.status !== 0) process.exit(progressCommand.status ?? 2)

const summary = JSON.parse(readFileSync(resolve(root, summaryPath), 'utf8'))
const responsePayload = JSON.parse(readFileSync(resolve(root, responsesPath), 'utf8'))
console.log(JSON.stringify({
  status: summary.status,
  suite_version: summary.suite_version,
  responses: Array.isArray(responsePayload.responses) ? responsePayload.responses.length : 0,
  adjudications: Array.isArray(responsePayload.adjudications) ? responsePayload.adjudications.length : 0,
  completed_groups: summary.completed_groups,
  required_groups: summary.required_groups,
  summary: summaryPath,
  progress: progressPath,
  baseline_untouched: versionDirectory !== 'v0.2' || process.env.DHEVALS_CALIBRATION_PROMOTE_LATEST !== '1',
}, null, 2))

if (summary.status === 'invalid') process.exit(2)
