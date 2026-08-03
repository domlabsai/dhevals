import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const directory = mkdtempSync(resolve(tmpdir(), 'dhevals-calibration-import-'))
const adjudicationSheet = resolve(directory, 'adjudication.csv')
const responses = resolve(directory, 'responses.json')
const summary = resolve(directory, 'summary.json')
const progress = resolve(directory, 'progress.json')
const sharedSheet = resolve(directory, 'review.csv')
writeFileSync(adjudicationSheet, 'task_id,dimension_id,dimension_guidance,anchor_level,example_output,example_target,adjudicated_score,adjudication_notes\n', 'utf8')

try {
  const command = spawnSync(process.execPath, ['scripts/import-calibration.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      DHEVALS_CALIBRATION_VERSION: 'v0.3',
      DHEVALS_CALIBRATION_ADJUDICATIONS: adjudicationSheet,
      DHEVALS_CALIBRATION_RESPONSES: responses,
      DHEVALS_CALIBRATION_SUMMARY: summary,
      DHEVALS_CALIBRATION_PROGRESS_OUTPUT: progress,
      DHEVALS_CALIBRATION_SHARED_SHEET: sharedSheet,
    },
  })
  if (command.status !== 0) throw new Error(`calibration import exited ${command.status}: ${command.stderr || command.stdout}`)
  const payload = JSON.parse(readFileSync(responses, 'utf8'))
  if (!Array.isArray(payload.adjudications) || payload.adjudications.length !== 0) throw new Error('empty adjudication sheet was not merged deterministically')
  console.log(JSON.stringify({ status: 'ready', responses: payload.responses.length, adjudications: payload.adjudications.length, summary, progress }, null, 2))
} finally {
  rmSync(directory, { recursive: true, force: true })
}
