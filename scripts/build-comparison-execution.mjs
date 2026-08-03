import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const registryPath = process.env.DHEVALS_COMPARISON_REGISTRY || 'benchmarks/comparisons/v0.3/models.json'
const summaryPath = process.env.DHEVALS_COMPARISON_SUMMARY || 'reports/comparisons/latest.json'
const outputPath = process.env.DHEVALS_COMPARISON_EXECUTION_OUTPUT || 'public/data/comparison-execution-latest.json'
const registry = readJson(resolve(root, registryPath), 'comparison registry')
const suiteDirectory = String(registry.suite_version).replace(/^v/, '').split('.').slice(0, 2).join('.')
const suitePath = `benchmarks/suites/heavy-user-ptbr/v${suiteDirectory}/suite.json`
const suite = existsSync(resolve(root, suitePath)) ? readJson(resolve(root, suitePath), 'comparison suite') : null
const summary = existsSync(resolve(root, summaryPath)) ? readJson(resolve(root, summaryPath), 'comparison summary') : null
const summaryCompatible = Boolean(summary?.outcomes && summary.suite_id === registry.suite_id && summary.suite_version === registry.suite_version)

const outcomes = new Map((summaryCompatible ? summary.outcomes : []).filter((outcome) => outcome?.model_id).map((outcome) => [outcome.model_id, outcome]))
const models = (registry.models || []).map((model) => {
  const outcome = outcomes.get(model.id)
  const adapter = model.adapter || (model.cli_command_env ? 'command-line' : 'openai-compatible')
  const configurationEnv = adapter === 'command-line' || adapter === 'cli' ? model.cli_command_env : model.base_url_env
  const configured = Boolean(configurationEnv && process.env[configurationEnv])
  const status = outcome?.status || (configured ? 'configured-not-run' : model.status === 'endpoint-not-configured' ? 'endpoint-not-configured' : 'not-run')
  const reportPath = outcome?.report ? safeRelative(outcome.report) : null
  const report = outcome?.report && existsSync(resolve(root, outcome.report)) ? readJson(resolve(root, outcome.report), 'comparison report') : null
  return {
    id: model.id,
    label: model.label || model.id,
    provider: model.provider || 'unknown',
    publication: model.publication || 'comparison-only',
    adapter: adapter === 'cli' ? 'command-line' : adapter,
    endpoint_env: model.base_url_env || null,
    command_env: model.cli_command_env || null,
    endpoint_configured: configured,
    status,
    run_id: outcome?.run_id || null,
    artifact: reportPath ? {
      report: reportPath,
      report_hash: report ? sha256Json(report) : null,
    } : null,
    score: null,
    score_status: 'locked_until_release_gate',
  }
})

const completed = models.filter((model) => model.status === 'completed')
const hasSummary = summaryCompatible
const allCompleted = models.length > 0 && models.every((model) => model.status === 'completed')
const status = !hasSummary ? 'pending' : allCompleted ? 'ready' : completed.length ? 'partial' : 'blocked'
const execution = {
  mode: hasSummary ? 'archive_only_candidate' : 'not_run',
  completed_models: completed.length,
  configured_models: models.filter((model) => model.endpoint_configured).length,
  total_models: models.length,
  report_count: models.filter((model) => model.artifact?.report).length,
  same_suite_hash_required: registry.policy?.same_suite_hash_required === true,
  same_generation_config_required: registry.policy?.same_generation_config_required === true,
  fixture_scores_public: registry.policy?.fixture_scores_public === true,
}

const artifact = {
  kind: 'dhevals_comparison_execution',
  schema_version: '0.1.0',
  generated_at: new Date().toISOString(),
  status,
  purpose: 'same-suite model comparison with locked scores until release gates pass',
  suite: {
    id: registry.suite_id || suite?.id || null,
    version: registry.suite_version || suite?.version || null,
    hash: suite ? sha256Json(suite) : null,
    registry: safeRelative(registryPath),
  },
  policy: registry.policy || {},
  primary_model_id: process.env.DHEVALS_COMPARISON_PRIMARY_MODEL_ID || registry.policy?.primary_model_id || registry.models?.find((model) => model.publication === 'primary')?.id || registry.models?.[0]?.id || null,
  generation: registry.generation || {},
  models,
  execution,
  provenance: {
    summary: hasSummary ? safeRelative(summaryPath) : null,
    runner: 'scripts/run-comparison.mjs',
    scores: 'not copied into this contract; use verified report and release gate artifacts',
    secrets_recorded: false,
  },
}

mkdirSync(resolve(outputPath, '..'), { recursive: true })
writeFileSync(resolve(root, outputPath), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: resolve(root, outputPath), status, models: models.length, completed: completed.length }, null, 2))

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

function safeRelative(value) {
  const absolute = resolve(root, value)
  if (!absolute.startsWith(`${root}/`)) return `external/${absolute.split('/').pop() || 'artifact.json'}`
  return relative(root, absolute)
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(sortKeys(value)), 'utf8').digest('hex')
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
  return value
}
