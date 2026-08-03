import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const directory = mkdtempSync(join(tmpdir(), 'dhevals-calibration-ready-'))
const examplesPath = resolve(root, 'benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-examples.json')
const rubricPath = resolve(root, 'benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-rubric.json')
const packPath = resolve(root, 'reports/calibration/heavy-user-ptbr-v0.3-blind/pack.json')
const sheetPaths = ['reviewer-a', 'reviewer-b'].map((reviewer) => join(directory, `${reviewer}.csv`))
const responsesPath = join(directory, 'responses.json')
const summaryPath = join(directory, 'summary.json')
const progressPath = join(directory, 'progress.json')
const sharedSheetPath = join(directory, 'shared.csv')
const protectedPaths = [
  'benchmarks/calibration/heavy-user-ptbr/v0.3/responses-reviewed.json',
  'reports/calibration/heavy-user-ptbr-v0.3-summary.json',
  'public/data/calibration/v0.3/progress.json',
]
const protectedBefore = new Map(protectedPaths.map((path) => [path, readIfPresent(resolve(root, path))]))

try {
  const rubric = JSON.parse(readFileSync(rubricPath, 'utf8'))
  const examples = JSON.parse(readFileSync(examplesPath, 'utf8'))
  const groups = []
  for (const [taskId, task] of Object.entries(rubric.tasks ?? {})) {
    const taskExamples = Array.isArray(examples.tasks?.[taskId]) ? examples.tasks[taskId] : []
    for (const dimension of task.dimensions ?? []) {
      for (const anchorLevel of [0, 1, 2, 3, 4]) {
        const example = taskExamples.find((candidate) => candidate.level === anchorLevel)
        if (!example) throw new Error(`missing anchor example for ${taskId}/${dimension.id}/${anchorLevel}`)
        groups.push({
          task_id: taskId,
          dimension_id: dimension.id,
          dimension_guidance: dimension.what_to_look_for,
          anchor_level: anchorLevel,
          example_output: example.output,
          example_target: example.target,
        })
      }
    }
  }
  if (groups.length !== 300) throw new Error(`expected 300 v0.3 groups, received ${groups.length}`)
  const header = ['task_id', 'dimension_id', 'dimension_guidance', 'anchor_level', 'example_output', 'example_target', 'score', 'notes']
  const rows = groups.map((group) => [
    group.task_id,
    group.dimension_id,
    group.dimension_guidance,
    group.anchor_level,
    group.example_output,
    group.example_target,
    group.anchor_level,
    'synthetic calibration smoke only',
  ])
  for (const sheetPath of sheetPaths) writeFileSync(sheetPath, `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8')

  const result = spawnSync(process.execPath, ['scripts/import-calibration.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      DHEVALS_CALIBRATION_VERSION: 'v0.3',
      DHEVALS_CALIBRATION_PACK: packPath,
      DHEVALS_CALIBRATION_RUBRIC: rubricPath,
      DHEVALS_CALIBRATION_REVIEWER_A: sheetPaths[0],
      DHEVALS_CALIBRATION_REVIEWER_B: sheetPaths[1],
      DHEVALS_CALIBRATION_RESPONSES: responsesPath,
      DHEVALS_CALIBRATION_SUMMARY: summaryPath,
      DHEVALS_CALIBRATION_PROGRESS_OUTPUT: progressPath,
      DHEVALS_CALIBRATION_SHARED_SHEET: sharedSheetPath,
    },
  })
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  if (result.status !== 0) throw new Error(`calibration import exited with status ${result.status}`)

  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  const progress = JSON.parse(readFileSync(progressPath, 'utf8'))
  const responses = JSON.parse(readFileSync(responsesPath, 'utf8'))
  if (summary.status !== 'ready' || summary.completed_groups !== 300 || summary.required_groups !== 300) throw new Error('synthetic calibration did not reach ready for all 300 groups')
  if (progress.status !== 'ready' || progress.completed_groups !== 300) throw new Error('progress artifact did not reach ready')
  if (!Array.isArray(responses.responses) || responses.responses.length !== 600) throw new Error(`expected 600 reviewer responses, received ${responses.responses?.length ?? 0}`)
  if (responses.responses.some((response) => response.reviewer_id !== 'reviewer-a' && response.reviewer_id !== 'reviewer-b')) throw new Error('unexpected reviewer id in imported responses')
  const publicArtifactsUntouched = protectedPaths.every((path) => readIfPresent(resolve(root, path)) === protectedBefore.get(path))
  if (!publicArtifactsUntouched) throw new Error('calibration smoke mutated a protected artifact')
  console.log(JSON.stringify({
    status: 'passed',
    suite_version: summary.suite_version,
    reviewers: 2,
    responses: responses.responses.length,
    completed_groups: summary.completed_groups,
    public_artifacts_untouched: publicArtifactsUntouched,
    synthetic_only: true,
  }, null, 2))
} finally {
  rmSync(directory, { recursive: true, force: true })
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function readIfPresent(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}
