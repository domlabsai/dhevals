import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const versions = ['v0.2', 'v0.3']

for (const versionDirectory of versions) {
  const version = versionDirectory.slice(1)
  const base = resolve(root, 'benchmarks/calibration/heavy-user-ptbr', versionDirectory)
  const suitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr', versionDirectory, 'suite.json')
  const rubricPath = resolve(base, 'anchor-rubric.json')
  const examplesPath = resolve(base, 'anchor-examples.json')
  const packPath = resolve(root, 'reports/calibration', `heavy-user-ptbr-${versionDirectory}-blind`, 'pack.json')
  if (!existsSync(rubricPath) || !existsSync(examplesPath) || !existsSync(suitePath)) continue
  const rubric = readJson(rubricPath)
  const examples = readJson(examplesPath)
  const suite = readJson(suitePath)
  const pack = existsSync(packPath) ? readJson(packPath) : null
  const groups = []
  for (const [taskId, taskRubric] of Object.entries(rubric.tasks || {})) {
    const suiteTask = (suite.tasks || []).find((task) => task.id === taskId)
    const taskExamples = examples.tasks?.[taskId] || []
    for (const dimension of taskRubric.dimensions || []) {
      for (const anchorLevel of [0, 1, 2, 3, 4]) {
        const example = taskExamples.find((candidate) => candidate.level === anchorLevel)
        if (!example) throw new Error(`missing ${taskId} level ${anchorLevel}`)
        groups.push({
          group_id: `${taskId}::${dimension.id}::${anchorLevel}`,
          task_id: taskId,
          task_title: suiteTask?.title || taskId,
          category: suiteTask?.category || 'Other',
          dimension_id: dimension.id,
          dimension_label: dimension.label || dimension.id,
          dimension_guidance: dimension.what_to_look_for || dimension.label || '',
          anchor_level: anchorLevel,
          example_output: example.output,
          example_target: example.target,
        })
      }
    }
  }
  const output = resolve(root, 'public/data/calibration', versionDirectory, 'review-data.json')
  const payload = {
    kind: 'dhevals_calibration_review_data',
    schema_version: '0.1.0',
    suite_id: rubric.suite_id,
    suite_version: rubric.suite_version,
    version,
    source: {
      rubric: relative(root, rubricPath),
      examples: relative(root, examplesPath),
      pack: existsSync(packPath) ? relative(root, packPath) : null,
    },
    pack,
    tasks: [...new Map(groups.map((group) => [group.task_id, { id: group.task_id, title: group.task_title, category: group.category }])).values()],
    dimensions: [...new Map(groups.map((group) => [group.dimension_id, { id: group.dimension_id, label: group.dimension_label }])).values()],
    groups,
    generated_at: new Date().toISOString(),
  }
  mkdirSync(resolve(output, '..'), { recursive: true })
  writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ output, suite_version: version, groups: groups.length, pack: payload.source.pack }, null, 2))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}
