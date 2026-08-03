import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const summaryPath = resolve(root, process.env.DHEVALS_CALIBRATION_SUMMARY || 'reports/calibration/heavy-user-ptbr-v0.2-summary.json')
const responsesPath = resolve(root, process.env.DHEVALS_CALIBRATION_RESPONSES || 'benchmarks/calibration/heavy-user-ptbr/v0.2/responses-reviewed.json')
const rubricPath = resolve(root, process.env.DHEVALS_CALIBRATION_RUBRIC || 'benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json')
const examplesPath = resolve(root, process.env.DHEVALS_CALIBRATION_EXAMPLES || 'benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-examples.json')
const sharedSheetPath = resolve(root, process.env.DHEVALS_CALIBRATION_SHARED_SHEET || 'reports/calibration/heavy-user-ptbr-v0.2-review.csv')
const blindDirectory = resolve(root, process.env.DHEVALS_CALIBRATION_BLIND_DIR || 'reports/calibration/heavy-user-ptbr-v0.2-blind')
const packPath = resolve(root, process.env.DHEVALS_CALIBRATION_PACK || `${process.env.DHEVALS_CALIBRATION_BLIND_DIR || 'reports/calibration/heavy-user-ptbr-v0.2-blind'}/pack.json`)
const outputPath = resolve(root, process.env.DHEVALS_CALIBRATION_PROGRESS_OUTPUT || 'public/data/latest-calibration.json')

if (!existsSync(summaryPath)) {
  console.error(`Calibration summary not found: ${summaryPath}`)
  process.exit(2)
}

const summary = readJson(summaryPath, 'calibration summary')
const responsePayload = existsSync(responsesPath) ? readJson(responsesPath, 'calibration responses') : { responses: [] }
const responses = Array.isArray(responsePayload.responses) ? responsePayload.responses : []
const validResponses = responses.filter((response) => response && typeof response === 'object' && typeof response.reviewer_id === 'string')
const reviewerMap = new Map()
for (const response of validResponses) {
  const reviewerId = response.reviewer_id.trim()
  if (!reviewerId) continue
  const groupId = `${response.task_id ?? ''}::${response.dimension_id ?? ''}::${response.anchor_level ?? ''}`
  const reviewer = reviewerMap.get(reviewerId) ?? { reviewer_id: reviewerId, responses: 0, groups_reviewed: new Set() }
  reviewer.responses += 1
  reviewer.groups_reviewed.add(groupId)
  reviewerMap.set(reviewerId, reviewer)
}

const groups = Array.isArray(summary.groups) ? summary.groups : []
const groupStatusCounts = groups.reduce((counts, group) => {
  const status = typeof group?.status === 'string' ? group.status : 'unknown'
  counts[status] = (counts[status] ?? 0) + 1
  return counts
}, {})
const requiredGroups = asNumber(summary.required_groups)
const completedGroups = asNumber(summary.completed_groups)
const completionPercent = requiredGroups > 0 ? Math.round((completedGroups / requiredGroups) * 1000) / 10 : 0
const blindSheets = existsSync(blindDirectory)
  ? ['reviewer-a.csv', 'reviewer-b.csv'].filter((name) => existsSync(resolve(blindDirectory, name))).map((name) => relative(root, resolve(blindDirectory, name)))
  : []

const progress = {
  kind: 'dhevals_calibration_progress',
  suite_id: summary.suite_id ?? responsePayload.suite_id ?? null,
  suite_version: summary.suite_version ?? responsePayload.suite_version ?? null,
  status: summary.status ?? 'pending',
  ready: summary.status === 'ready',
  completion_percent: completionPercent,
  required_groups: requiredGroups,
  completed_groups: completedGroups,
  missing_groups: Array.isArray(summary.missing_groups) ? summary.missing_groups : [],
  disagreement_groups: Array.isArray(summary.disagreement_groups) ? summary.disagreement_groups : [],
  adjudicated_groups: Array.isArray(summary.adjudicated_groups) ? summary.adjudicated_groups : [],
  validation_errors: Array.isArray(summary.validation_errors) ? summary.validation_errors : [],
  gate: {
    leaderboard: summary.status === 'ready' ? 'eligible' : 'locked',
    reason: summary.status === 'ready' ? null : 'human calibration is not ready',
  },
  review: {
    reviewers_required: asNumber(summary.reviewers_required) || 2,
    reviewers_present: reviewerMap.size,
    responses_total: validResponses.length,
    group_status_counts: groupStatusCounts,
    reviewers: [...reviewerMap.values()]
      .sort((left, right) => left.reviewer_id.localeCompare(right.reviewer_id))
      .map((reviewer) => ({ ...reviewer, groups_reviewed: reviewer.groups_reviewed.size })),
  },
  audit: {
    rubric: relative(root, rubricPath),
    examples: relative(root, examplesPath),
    responses: relative(root, responsesPath),
    summary: relative(root, summaryPath),
    response_sources: responsePayload.source_sheets ?? responsePayload.source_sheet ?? null,
    shared_sheet: existsSync(sharedSheetPath) ? relative(root, sharedSheetPath) : null,
    blind_sheets: blindSheets,
    pack: existsSync(packPath) ? relative(root, packPath) : null,
  },
  generated_at: new Date().toISOString(),
}

mkdirSync(resolve(outputPath, '..'), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(progress, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: relative(root, outputPath), status: progress.status, completed_groups: completedGroups, required_groups: requiredGroups, completion_percent: completionPercent }, null, 2))

function readJson(path, label) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected an object')
    return value
  } catch (error) {
    console.error(`Unable to read ${label} at ${path}: ${error.message}`)
    process.exit(2)
  }
}

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
