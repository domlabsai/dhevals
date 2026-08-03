import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { verifyRunArtifact } from './verify-run.mjs'

// Generic model lane.  Unlike run-sacilm.mjs, this command has no model-
// specific manifest or preflight requirement and is archive-only by design.
// It is the supported entry point for comparison models and local CLIs.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const modelId = process.env.DHEVALS_MODEL_ID
if (!modelId) fail('Missing DHEVALS_MODEL_ID (for example qwen-local or kimi-cli).')

const adapter = process.env.DHEVALS_MODEL_ADAPTER || (process.env.DHEVALS_MODEL_CLI_COMMAND ? 'command-line' : 'openai-compatible')
const provider = process.env.DHEVALS_MODEL_PROVIDER || (adapter === 'command-line' ? 'command-line' : 'openai-compatible')
const suitePath = process.env.DHEVALS_MODEL_SUITE_PATH || 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json'
const suiteAbsolutePath = resolve(root, suitePath)
const suite = readJson(suiteAbsolutePath, 'suite manifest')
const runId = process.env.DHEVALS_RUN_ID || `${modelId}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const runsDirectory = resolve(root, process.env.DHEVALS_MODEL_RUNS_DIR || 'reports/runs')
const archiveOutput = resolve(runsDirectory, `${runId}.json`)
const verificationOutput = resolve(runsDirectory, `${runId}.verification.json`)
const reportOutput = resolve(runsDirectory, `${runId}.report.json`)
const youtubeOutput = resolve(runsDirectory, `${runId}.youtube.json`)
const htmlOutput = resolve(runsDirectory, `${runId}.html`)
const csvOutput = resolve(runsDirectory, `${runId}.csv`)
const temperature = process.env.DHEVALS_MODEL_TEMPERATURE || '0.2'
const maxTokens = process.env.DHEVALS_MODEL_MAX_TOKENS || '2048'
const seed = process.env.DHEVALS_MODEL_SEED || '7'

const args = [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-run',
  '--suite', suitePath,
  '--provider', provider,
  '--model-id', modelId,
  '--temperature', temperature,
  '--max-tokens', maxTokens,
  '--seed', seed,
  '--run-id', runId,
  '--output', archiveOutput,
]

if (adapter === 'command-line' || adapter === 'cli') {
  const command = process.env.DHEVALS_MODEL_CLI_COMMAND
  if (!command) fail('Missing DHEVALS_MODEL_CLI_COMMAND for the command-line adapter.')
  args.push('--cli-command', command)
  args.push('--cli-prompt-mode', process.env.DHEVALS_MODEL_CLI_PROMPT_MODE || 'stdin')
  args.push('--cli-timeout-seconds', process.env.DHEVALS_MODEL_CLI_TIMEOUT_SECONDS || '120')
  if (process.env.DHEVALS_MODEL_CLI_CWD) args.push('--cli-cwd', process.env.DHEVALS_MODEL_CLI_CWD)
} else if (adapter === 'openai-compatible' || adapter === 'http') {
  const baseUrl = process.env.DHEVALS_MODEL_BASE_URL
  if (!baseUrl) fail('Missing DHEVALS_MODEL_BASE_URL for the OpenAI-compatible adapter.')
  args.push('--base-url', baseUrl)
  args.push('--api-key-env', process.env.DHEVALS_MODEL_API_KEY_ENV || 'DHEVALS_MODEL_API_KEY')
} else {
  fail(`Unsupported DHEVALS_MODEL_ADAPTER: ${adapter}`)
}

for (const [environmentKey, argument] of [
  ['DHEVALS_MODEL_INPUT_COST_PER_1K', '--input-cost-per-1k'],
  ['DHEVALS_MODEL_OUTPUT_COST_PER_1K', '--output-cost-per-1k'],
  ['DHEVALS_MODEL_CHECKPOINT', '--checkpoint'],
  ['DHEVALS_MODEL_RUNTIME', '--runtime'],
  ['DHEVALS_MODEL_TRAINING_COMMIT', '--training-commit'],
  ['DHEVALS_MODEL_MANIFEST', '--model-manifest'],
]) {
  if (process.env[environmentKey]) args.push(argument, process.env[environmentKey])
}

mkdirSync(runsDirectory, { recursive: true })
const runCommand = spawnSync('uv', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(runCommand.stdout || '')
process.stderr.write(runCommand.stderr || '')
if (runCommand.status !== 0) process.exit(runCommand.status ?? 1)
if (!existsSync(archiveOutput)) fail(`Runner completed without writing ${archiveOutput}`)

const verificationStatus = verifyRunArtifact({ artifactPath: archiveOutput, suitePath: suiteAbsolutePath, outputPath: verificationOutput })
if (verificationStatus !== 0) fail('Model run failed reproducibility verification.')

const reportCommand = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-report',
  '--input', archiveOutput,
  '--report-output', reportOutput,
  '--youtube-output', youtubeOutput,
  '--html-output', htmlOutput,
  '--csv-output', csvOutput,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(reportCommand.stdout || '')
process.stderr.write(reportCommand.stderr || '')
if (reportCommand.status !== 0) process.exit(reportCommand.status ?? 1)

const reportVerificationStatus = verifyRunArtifact({ artifactPath: archiveOutput, suitePath: suiteAbsolutePath, reportPath: reportOutput, outputPath: verificationOutput })
if (reportVerificationStatus !== 0) fail('Derived model report failed reproducibility verification.')

for (const script of ['build-dataset-catalog.mjs', 'build-experiment-catalog.mjs']) {
  const derived = spawnSync(process.execPath, [`scripts/${script}`], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(derived.stdout || '')
  process.stderr.write(derived.stderr || '')
  if (derived.status !== 0) process.exit(derived.status ?? 1)
}

console.log(JSON.stringify({
  status: 'archived',
  model_id: modelId,
  provider,
  adapter: adapter === 'cli' ? 'command-line' : adapter,
  suite_id: suite.id,
  suite_version: suite.version,
  run_id: runId,
  run: archiveOutput,
  report: reportOutput,
  verification: verificationOutput,
  publication: 'archive-only',
}, null, 2))

function readJson(path, label) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected an object')
    return value
  } catch (error) {
    fail(`Unable to read ${label} at ${path}: ${error.message}`)
  }
}

function fail(message) {
  console.error(message)
  process.exit(2)
}
