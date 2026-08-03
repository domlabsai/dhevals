import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.1/suite.json')
const suite = JSON.parse(readFileSync(suitePath, 'utf8'))
const directory = mkdtempSync(resolve(tmpdir(), 'dhevals-model-cli-'))
const registryPath = resolve(directory, 'models.json')
const summaryPath = resolve(directory, 'comparison.json')
const executionPath = resolve(directory, 'comparison-execution.json')
const runsDirectory = resolve(directory, 'runs')
const registry = {
  suite_id: suite.id,
  suite_version: suite.version,
  policy: {
    same_suite_hash_required: true,
    same_generation_config_required: true,
    fixture_scores_public: false,
    human_calibration_required: true,
    primary_model_id: 'qwen-cli',
  },
  generation: { temperature: 0.2, max_tokens: 2048, seed: 7 },
  models: [{
    id: 'qwen-cli',
    label: 'Qwen CLI smoke',
    provider: 'qwen-cli',
    adapter: 'command-line',
    cli_command_env: 'DHEVALS_QWEN_COMMAND',
    cli_prompt_mode: 'stdin',
    publication: 'primary',
  }],
}
writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')

const command = "python -c 'import sys; print(\"DHEvals CLI\")'"
const result = await runNode('scripts/run-comparison.mjs', {
  ...process.env,
  DHEVALS_QWEN_COMMAND: command,
  DHEVALS_COMPARISON_REGISTRY: registryPath,
  DHEVALS_COMPARISON_SUITE: suitePath,
  DHEVALS_COMPARISON_RUNS_DIR: runsDirectory,
  DHEVALS_COMPARISON_SUMMARY: summaryPath,
  DHEVALS_COMPARISON_EXECUTION_OUTPUT: executionPath,
  DHEVALS_RUN_ID: 'model-cli-wrapper',
})
if (result.status !== 0) throw new Error(`command-line comparison exited ${result.status}: ${result.stderr || result.stdout}`)
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
const execution = JSON.parse(readFileSync(executionPath, 'utf8'))
if (summary.outcomes.length !== 1 || summary.outcomes[0].status !== 'completed') throw new Error('CLI comparison did not complete the primary lane')
if (summary.outcomes[0].adapter !== 'command-line') throw new Error('CLI comparison did not record its adapter')
if (execution.primary_model_id !== 'qwen-cli' || execution.status !== 'ready') throw new Error('CLI comparison contract did not select the generic primary model')
if (execution.models[0].score !== null || execution.models[0].score_status !== 'locked_until_release_gate') throw new Error('CLI comparison exposed a score before release')
console.log(JSON.stringify({ status: 'ready', adapter: 'command-line', primary_model_id: execution.primary_model_id, completed_models: execution.execution.completed_models }, null, 2))
rmSync(directory, { recursive: true, force: true })

function runNode(script, env) {
  return new Promise((resolveChild) => {
    const child = spawn(process.execPath, [script], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('close', (code) => resolveChild({ status: code ?? 1, stdout, stderr }))
  })
}
