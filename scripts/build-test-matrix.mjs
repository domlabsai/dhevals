import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const mode = process.argv[2] || 'build'
const versions = (process.env.DHEVALS_TEST_MATRIX_VERSIONS || 'v0.2,v0.3')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const SCORECARD_COVERAGE = [
  { dimension: 'quality', mode: 'deterministic', status: 'contracted', evidence: ['checks', 'positive_negative_fixtures'] },
  { dimension: 'factuality', mode: 'independent_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['source_grounded_tasks', 'judge_artifact'] },
  { dimension: 'hallucination', mode: 'independent_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['non_invention_checks', 'safety_artifact', 'judge_artifact'] },
  { dimension: 'safety', mode: 'independent_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['safety-ptbr/v0.1'] },
  { dimension: 'alignment', mode: 'independent_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['stakeholder_conflict', 'judge_artifact'] },
  { dimension: 'robustness', mode: 'replay_and_adversarial', status: 'contracted_not_evaluated_by_default', evidence: ['negative_fixtures', 'grader_matrix', 'replay_contract'] },
  { dimension: 'reasoning', mode: 'independent_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['research_planning_data_tasks', 'judge_artifact'] },
  { dimension: 'programming', mode: 'independent_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['code_tasks', 'judge_artifact'] },
  { dimension: 'tool_use', mode: 'trace_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['agent-ptbr/v0.1'] },
  { dimension: 'agentic', mode: 'trace_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['agent-ptbr/v0.1'] },
  { dimension: 'business_logic', mode: 'independent_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['policy_exception', 'safe_automation', 'judge_artifact'] },
  { dimension: 'memory', mode: 'long_context_artifact', status: 'contracted_not_evaluated_by_default', evidence: ['long_context_tasks', 'longitudinal_fixture_pending'] },
  { dimension: 'instruction_following', mode: 'deterministic_and_judge', status: 'contracted_not_evaluated_by_default', evidence: ['schema_and_format_checks', 'judge_artifact'] },
  { dimension: 'operational_reliability', mode: 'operational_metrics', status: 'contracted', evidence: ['coverage', 'errors', 'latency', 'tokens', 'replay_contract'] },
]

const built = []
for (const versionDirectory of versions) {
  const matrixPath = resolve(root, 'benchmarks/tests/heavy-user-ptbr', versionDirectory, 'test-matrix.json')
  const expected = buildMatrix(versionDirectory)
  if (mode === 'build') {
    mkdirSync(resolve(matrixPath, '..'), { recursive: true })
    writeFileSync(matrixPath, `${JSON.stringify(expected, null, 2)}\n`, 'utf8')
  } else if (!existsSync(matrixPath)) {
    throw new Error(`test matrix not found: ${relative(root, matrixPath)}`)
  }

  const actual = mode === 'build' ? expected : readJson(matrixPath)
  validateMatrix(actual, expected, versionDirectory)
  built.push({
    version: expected.suite.version,
    path: relative(root, matrixPath),
    task_count: expected.coverage.task_count,
    scenario_count: expected.coverage.scenario_count,
    rubric_dimension_count: expected.coverage.rubric_dimension_count,
    scorecard_dimension_count: expected.scorecard_coverage.length,
    scorecard_dimensions: expected.scorecard_coverage.map(({ dimension, mode, status }) => ({ dimension, mode, status })),
    anchor_group_count: expected.coverage.anchor_group_count,
    model_lane_count: expected.coverage.model_lane_count,
    suite_hash: expected.sources.hashes.suite,
  })
}

const catalogPath = resolve(root, 'public/data/test-matrix-catalog.json')
mkdirSync(resolve(catalogPath, '..'), { recursive: true })
const catalog = {
  kind: 'dhevals_test_matrix_catalog',
  schema_version: '0.1.0',
  status: 'ready',
  versions: built,
}
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ mode, status: 'ready', matrices: built, catalog: relative(root, catalogPath) }, null, 2))

function buildMatrix(versionDirectory) {
  const version = versionDirectory.replace(/^v/, '')
  const suitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr', versionDirectory, 'suite.json')
  const positiveFixturePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr', versionDirectory, 'fixtures/sacilm-calibration-fixture.json')
  const negativeFixturePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr', versionDirectory, 'fixtures/negative-fixture.json')
  const rubricPath = resolve(root, 'benchmarks/calibration/heavy-user-ptbr', versionDirectory, 'anchor-rubric.json')
  const examplesPath = resolve(root, 'benchmarks/calibration/heavy-user-ptbr', versionDirectory, 'anchor-examples.json')
  const registryPath = resolve(root, 'benchmarks/comparisons', versionDirectory, 'models.json')
  for (const path of [suitePath, positiveFixturePath, negativeFixturePath, rubricPath, examplesPath, registryPath]) {
    if (!existsSync(path)) throw new Error(`test matrix source not found: ${relative(root, path)}`)
  }

  const suite = readJson(suitePath)
  const positiveFixture = readJson(positiveFixturePath)
  const negativeFixture = readJson(negativeFixturePath)
  const rubric = readJson(rubricPath)
  const examples = readJson(examplesPath)
  const registry = readJson(registryPath)
  const suiteTasks = suite.tasks || []
  const suiteTaskIds = suiteTasks.map((task) => task.id)
  const rubricTasks = rubric.tasks || {}
  const positiveFixtureIds = Object.keys(positiveFixture)
  const negativeFixtureIds = Object.keys(negativeFixture)
  const exampleTaskIds = Object.keys(examples.tasks || {})
  if (registry.suite_id !== suite.id || registry.suite_version !== suite.version) {
    throw new Error(`comparison registry identity does not match ${versionDirectory}`)
  }
  if (!sameSet(suiteTaskIds, Object.keys(rubricTasks))) throw new Error(`rubric task coverage does not match ${versionDirectory}`)
  if (!sameSet(suiteTaskIds, exampleTaskIds)) throw new Error(`anchor example task coverage does not match ${versionDirectory}`)
  if (!sameSet(suiteTaskIds, positiveFixtureIds)) throw new Error(`positive fixture task coverage does not match ${versionDirectory}`)
  if (!sameSet(suiteTaskIds, negativeFixtureIds)) throw new Error(`negative fixture task coverage does not match ${versionDirectory}`)
  const modelLanes = (registry.models || []).map((model) => {
    const adapter = model.adapter || (model.cli_command_env ? 'command-line' : 'openai-compatible')
    return {
      model_id: model.id,
      label: model.label,
      provider: model.provider,
      adapter,
      role: model.publication === 'primary' ? 'primary' : 'comparison',
      preflight: model.id === 'sacilm' && adapter === 'openai-compatible' ? 'required' : 'registry-only',
      endpoint_env: model.base_url_env || null,
      command_env: model.cli_command_env || null,
      api_key_env: model.api_key_env,
      publication: model.publication,
    }
  })
  const tasks = suiteTasks.map((task) => {
    const taskRubric = rubricTasks[task.id]
    if (!taskRubric) throw new Error(`rubric is missing task ${task.id}`)
    const dimensions = taskRubric.dimensions || []
    const taskExamples = examples.tasks?.[task.id] || []
    const missingLevels = [0, 1, 2, 3, 4].filter((level) => !taskExamples.some((example) => example.level === level))
    if (missingLevels.length) throw new Error(`${task.id} is missing anchor levels ${missingLevels.join(', ')}`)
    if (!positiveFixture[task.id] || !negativeFixture[task.id]) throw new Error(`${task.id} is missing from a fixture`)
    const checks = (task.checks || []).map((check) => ({ id: check.id, type: check.type }))
    const rubricDimensions = dimensions.map((dimension) => ({ id: dimension.id, weight: dimension.weight, guidance: dimension.what_to_look_for }))
    return {
      task_id: task.id,
      title: task.title,
      category: task.category,
      task_contract: {
        locale: suite.locale,
        context_ref: task.metadata?.input_ref || null,
        allowed_tools: [],
        max_output_tokens: registry.generation?.max_tokens ?? null,
        input_classification: 'synthetic-or-licensed',
        pii_allowed: false,
        temporal_knowledge: 'frozen-fixture',
      },
      input_ref: task.metadata?.input_ref || null,
      expected_artifact: task.metadata?.expected_artifact || null,
      publication: task.metadata?.publication || 'calibration',
      adapters: ['fixture', ...[...new Set(modelLanes.map((model) => model.adapter))].sort()],
      model_ids: modelLanes.map((model) => model.model_id),
      deterministic_checks: checks,
      rubric_dimensions: rubricDimensions,
      scenarios: [
        {
          id: 'positive-fixture',
          fixture: 'positive',
          expected_status: 'pass',
          expected_score: 1,
          infrastructure_errors_allowed: false,
          assertions: ['coverage includes this task', 'all deterministic checks pass', 'score remains quality-only'],
        },
        {
          id: 'negative-fixture',
          fixture: 'negative',
          expected_statuses: ['partial', 'fail'],
          expected_score_max_exclusive: 1,
          infrastructure_errors_allowed: false,
          assertions: ['coverage includes this task', 'at least one deterministic check fails', 'quality failure is not reported as infrastructure error'],
        },
      ],
      calibration: {
        anchors_per_dimension: 5,
        anchor_levels: [0, 1, 2, 3, 4],
        reviewers_required: registry.policy?.human_calibration_required ? 2 : 0,
        adjudication: 'required_on_disagreement',
      },
    }
  })
  const categoryCounts = {}
  for (const task of tasks) categoryCounts[task.category] = (categoryCounts[task.category] || 0) + 1
  const rubricDimensionCount = tasks.reduce((total, task) => total + task.rubric_dimensions.length, 0)
  const matrix = {
    kind: 'dhevals_test_matrix',
    schema_version: '0.1.0',
    suite: {
      id: suite.id,
      version: suite.version,
      locale: suite.locale,
      task_count: suiteTasks.length,
      category_count: Object.keys(categoryCounts).length,
    },
    sources: {
      suite: relative(root, suitePath),
      positive_fixture: relative(root, positiveFixturePath),
      negative_fixture: relative(root, negativeFixturePath),
      rubric: relative(root, rubricPath),
      examples: relative(root, examplesPath),
      comparison_registry: relative(root, registryPath),
      hashes: {
        suite: sha256Json(suite),
        positive_fixture: sha256Json(positiveFixture),
        negative_fixture: sha256Json(negativeFixture),
        rubric: sha256Json(rubric),
        examples: sha256Json(examples),
        comparison_registry: sha256Json(registry),
      },
    },
    coverage: {
      task_count: tasks.length,
      category_count: Object.keys(categoryCounts).length,
      tasks_per_category: categoryCounts,
      scenario_count: tasks.length * 2,
      scenarios_per_task: 2,
      deterministic_check_count: tasks.reduce((total, task) => total + task.deterministic_checks.length, 0),
      rubric_dimension_count: rubricDimensionCount,
      scorecard_dimension_count: SCORECARD_COVERAGE.length,
      anchor_group_count: rubricDimensionCount * 5,
      model_lane_count: modelLanes.length,
      adapter_lane_count: 1 + new Set(modelLanes.map((model) => model.adapter)).size,
    },
    execution_contract: {
      adapters: ['fixture', ...[...new Set(modelLanes.map((model) => model.adapter))].sort()],
      generation: registry.generation,
      same_suite_hash_required: registry.policy?.same_suite_hash_required === true,
      same_generation_config_required: registry.policy?.same_generation_config_required === true,
      infrastructure_errors_allowed_for_quality_scenarios: false,
      fixture_scores_public: registry.policy?.fixture_scores_public === true,
      human_calibration_required: registry.policy?.human_calibration_required === true,
    },
    scorecard_coverage: SCORECARD_COVERAGE,
    model_lanes: modelLanes,
    tasks,
  }
  if (suite.version !== `${version}.0`) throw new Error(`suite version ${suite.version} does not match ${versionDirectory}`)
  if (suiteTaskIds.length !== new Set(suiteTaskIds).size) throw new Error(`duplicate task id in ${versionDirectory}`)
  return matrix
}

function validateMatrix(actual, expected, versionDirectory) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`test matrix drift detected for ${versionDirectory}; run npm run build:test-matrix`)
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256Json(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}

function sameSet(left, right) {
  return left.length === right.length && new Set(left).size === new Set(right).size && left.every((value) => right.includes(value))
}
