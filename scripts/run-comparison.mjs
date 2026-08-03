import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { verifyRunArtifact } from './verify-run.mjs'
import { SACILM_DRAFT_MANIFEST, resolveSacilmManifestPath } from './sacilm-manifest-path.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const registryPath = resolve(root, process.env.DHEVALS_COMPARISON_REGISTRY || 'benchmarks/comparisons/v0.2/models.json')
const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
const suitePath = process.env.DHEVALS_COMPARISON_SUITE || 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json'
const suiteManifest = JSON.parse(readFileSync(resolve(root, suitePath), 'utf8'))
const promoteComparison = process.env.DHEVALS_COMPARISON_PROMOTE === '1'
if (registry.suite_id !== suiteManifest.id || registry.suite_version !== suiteManifest.version) {
  throw new Error(`comparison registry ${registry.suite_id}@${registry.suite_version} does not match suite ${suiteManifest.id}@${suiteManifest.version}`)
}
const generation = registry.generation || {}
const temperature = process.env.DHEVALS_COMPARISON_TEMPERATURE || String(generation.temperature ?? 0.2)
const maxTokens = process.env.DHEVALS_COMPARISON_MAX_TOKENS || String(generation.max_tokens ?? 2048)
const seed = process.env.DHEVALS_COMPARISON_SEED || String(generation.seed ?? 7)
const preflightMaxAgeMs = Number(process.env.DHEVALS_SACILM_PREFLIGHT_MAX_AGE_MS || 6 * 60 * 60 * 1000)
const primaryModelId = process.env.DHEVALS_COMPARISON_PRIMARY_MODEL_ID
  || registry.policy?.primary_model_id
  || registry.models?.find((model) => model.publication === 'primary')?.id
  || registry.models?.[0]?.id
const runStamp = process.env.DHEVALS_RUN_ID || `comparison-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const runsDirectory = resolve(root, process.env.DHEVALS_COMPARISON_RUNS_DIR || 'reports/runs')
const summaryPath = resolve(root, process.env.DHEVALS_COMPARISON_SUMMARY || 'reports/comparisons/latest.json')
mkdirSync(runsDirectory, { recursive: true })
mkdirSync(resolve(root, 'reports/comparisons'), { recursive: true })

const outcomes = []
const reportInputs = []
for (const model of registry.models || []) {
  const adapter = model.adapter || (model.cli_command_env ? 'command-line' : 'openai-compatible')
  const cliCommand = adapter === 'command-line' || adapter === 'cli' ? process.env[model.cli_command_env] : null
  const baseUrl = adapter === 'command-line' || adapter === 'cli' ? null : process.env[model.base_url_env]
  const configuredBy = adapter === 'command-line' || adapter === 'cli' ? model.cli_command_env : model.base_url_env
  if (!(cliCommand || baseUrl)) {
    outcomes.push({ model_id: model.id, provider: model.provider, adapter, status: 'skipped', reason: `missing ${configuredBy || 'model endpoint configuration'}` })
    continue
  }

  if (model.id === 'sacilm' && adapter !== 'command-line' && adapter !== 'cli' && process.env.DHEVALS_SACILM_SKIP_PREFLIGHT !== '1') {
    const preflightPath = resolve(root, process.env.DHEVALS_SACILM_PREFLIGHT_OUTPUT || 'reports/preflight/sacilm-latest.json')
    const preflight = loadPreflight(preflightPath)
    const expectedEndpoint = safeEndpoint(completionEndpoint(baseUrl))
    if (!preflight || preflight.status !== 'ready') {
      outcomes.push({ model_id: model.id, provider: model.provider, status: 'blocked', reason: 'SaciLM preflight is not ready', preflight: preflightPath })
      continue
    }
    if (!preflightIsFresh(preflight, preflightMaxAgeMs)) {
      outcomes.push({ model_id: model.id, provider: model.provider, status: 'blocked', reason: 'SaciLM preflight is expired', preflight: preflightPath })
      continue
    }
    if (preflight.model?.model_id && preflight.model.model_id !== model.id) {
      outcomes.push({ model_id: model.id, provider: model.provider, status: 'blocked', reason: 'SaciLM preflight model does not match registry model', preflight: preflightPath })
      continue
    }
    if (preflight.endpoint && preflight.endpoint !== expectedEndpoint) {
      outcomes.push({ model_id: model.id, provider: model.provider, status: 'blocked', reason: 'SaciLM preflight endpoint does not match registry endpoint', preflight: preflightPath })
      continue
    }
  }

  const runId = `${runStamp}-${model.id}`
  const output = resolve(runsDirectory, `${runId}.json`)
  const verificationOutput = resolve(runsDirectory, `${runId}.verification.json`)
  const args = [
    'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-run',
    '--suite', suitePath,
    '--provider', model.provider,
    '--model-id', model.id,
    '--temperature', temperature,
    '--max-tokens', maxTokens,
    '--seed', seed,
    '--run-id', runId,
    '--output', output,
  ]
  if (adapter === 'command-line' || adapter === 'cli') {
    args.push('--cli-command', cliCommand)
    args.push('--cli-prompt-mode', model.cli_prompt_mode || 'stdin')
    const timeout = model.cli_timeout_env && process.env[model.cli_timeout_env]
      ? process.env[model.cli_timeout_env]
      : model.cli_timeout_seconds || '120'
    args.push('--cli-timeout-seconds', String(timeout))
    const timeoutRetries = model.cli_timeout_retries_env && process.env[model.cli_timeout_retries_env]
      ? process.env[model.cli_timeout_retries_env]
      : model.cli_timeout_retries ?? process.env.DHEVALS_MODEL_CLI_TIMEOUT_RETRIES ?? '1'
    const timeoutBackoff = model.cli_timeout_backoff_env && process.env[model.cli_timeout_backoff_env]
      ? process.env[model.cli_timeout_backoff_env]
      : model.cli_timeout_backoff ?? process.env.DHEVALS_MODEL_CLI_TIMEOUT_BACKOFF ?? '2'
    args.push('--cli-timeout-retries', String(timeoutRetries))
    args.push('--cli-timeout-backoff', String(timeoutBackoff))
  } else {
    args.push('--base-url', baseUrl)
    if (model.api_key_env) args.push('--api-key-env', model.api_key_env)
  }
  const configuredManifest = process.env.DHEVALS_SACILM_MODEL_MANIFEST || (model.model_manifest === SACILM_DRAFT_MANIFEST ? '' : model.model_manifest)
  const modelManifestPath = model.id === 'sacilm' ? resolveSacilmManifestPath(root, configuredManifest) : model.model_manifest
  if (modelManifestPath && existsSync(resolve(root, modelManifestPath))) args.push('--model-manifest', modelManifestPath)
  if (model.input_cost_env && process.env[model.input_cost_env]) args.push('--input-cost-per-1k', process.env[model.input_cost_env])
  if (model.output_cost_env && process.env[model.output_cost_env]) args.push('--output-cost-per-1k', process.env[model.output_cost_env])
  for (const [registryKey, argument] of [['checkpoint_env', '--checkpoint'], ['runtime_env', '--runtime'], ['training_commit_env', '--training-commit']]) {
    const environmentKey = model[registryKey]
    if (environmentKey && process.env[environmentKey]) args.push(argument, process.env[environmentKey])
  }
  const command = spawnSync('uv', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(command.stdout || '')
  process.stderr.write(command.stderr || '')
  let outcomeStatus = command.status === 0 ? 'completed' : 'error'
  if (outcomeStatus === 'completed') {
    const runVerification = verifyRunArtifact({ artifactPath: output, suitePath: resolve(root, suitePath), outputPath: verificationOutput })
    if (runVerification !== 0) outcomeStatus = 'error'
  }
  const reportOutput = resolve(runsDirectory, `${runId}.report.json`)
  const youtubeOutput = resolve(runsDirectory, `${runId}.youtube.json`)
  const htmlOutput = resolve(runsDirectory, `${runId}.html`)
  const csvOutput = resolve(runsDirectory, `${runId}.csv`)
  if (existsSync(output)) {
    const reportCommand = spawnSync('uv', [
      'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-report',
    '--input', output, '--report-output', reportOutput, '--youtube-output', youtubeOutput,
    '--html-output', htmlOutput, '--csv-output', csvOutput,
    ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
    process.stdout.write(reportCommand.stdout || '')
    process.stderr.write(reportCommand.stderr || '')
    if (reportCommand.status === 0 && outcomeStatus === 'completed') {
      const reportVerification = verifyRunArtifact({ artifactPath: output, suitePath: resolve(root, suitePath), reportPath: reportOutput, outputPath: verificationOutput })
      if (reportVerification === 0) reportInputs.push(reportOutput)
      else outcomeStatus = 'error'
    }
    else outcomeStatus = 'error'
  }
  outcomes.push({ model_id: model.id, provider: model.provider, adapter, status: outcomeStatus, run_id: runId, run: output, report: reportOutput, verification: verificationOutput })
}

const summary = {
  registry: registryPath,
  suite: suitePath,
  suite_id: suiteManifest.id,
  suite_version: suiteManifest.version,
  generation: { temperature: Number(temperature), max_tokens: Number(maxTokens), seed: Number(seed) },
  run_stamp: runStamp,
  primary_model_id: primaryModelId || null,
  outcomes,
  report_inputs: reportInputs,
  generated_at: new Date().toISOString(),
}
writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8')
console.log(`Wrote ${summaryPath}`)

const comparisonExecution = spawnSync(process.execPath, ['scripts/build-comparison-execution.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
  env: {
    ...process.env,
    DHEVALS_COMPARISON_REGISTRY: registryPath,
    DHEVALS_COMPARISON_SUMMARY: summaryPath,
  },
})
process.stdout.write(comparisonExecution.stdout || '')
process.stderr.write(comparisonExecution.stderr || '')
if (comparisonExecution.status !== 0) process.exit(comparisonExecution.status ?? 1)

if (reportInputs.length && promoteComparison) {
  const primary = outcomes.find((outcome) => outcome.model_id === primaryModelId && outcome.status === 'completed')
  if (!primary) {
    console.error(`Comparison promotion requires a completed primary run for ${primaryModelId || 'the registry primary model'}.`)
    process.exit(2)
  }
  const candidateLeaderboard = resolve(root, process.env.DHEVALS_COMPARISON_LEADERBOARD_OUTPUT || `reports/comparisons/${runStamp}.leaderboard.json`)
  const candidateGate = resolve(root, process.env.DHEVALS_COMPARISON_RELEASE_GATE_OUTPUT || `reports/comparisons/${runStamp}.release-gate.json`)
  const candidateGatePublic = resolve(root, process.env.DHEVALS_COMPARISON_RELEASE_GATE_PUBLIC_OUTPUT || `reports/comparisons/${runStamp}.release-gate-public.json`)
  const auditPath = process.env.DHEVALS_COMPARISON_AUDIT_PATH || 'public/data/latest-audit.json'
  const calibrationPath = process.env.DHEVALS_COMPARISON_CALIBRATION_PATH || 'public/data/latest-calibration.json'
  const leaderboard = spawnSync(process.execPath, ['scripts/build-leaderboard.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      DHEVALS_LEADERBOARD_SUITE: suitePath,
      DHEVALS_LEADERBOARD_OUTPUT: candidateLeaderboard,
      DHEVALS_LEADERBOARD_REPORT_DIRS: process.env.DHEVALS_COMPARISON_REPORT_DIRS || runsDirectory,
    },
  })
  process.stdout.write(leaderboard.stdout || '')
  process.stderr.write(leaderboard.stderr || '')
  if (leaderboard.status !== 0) process.exit(leaderboard.status ?? 1)

  const stagedGate = spawnSync(process.execPath, ['scripts/build-release-gate.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      DHEVALS_RELEASE_SUITE: suitePath,
      DHEVALS_RELEASE_RUN: primary.run,
      DHEVALS_RELEASE_REPORT: primary.report,
      DHEVALS_RELEASE_VERIFICATION: primary.verification,
      DHEVALS_RELEASE_AUDIT: auditPath,
      DHEVALS_RELEASE_CALIBRATION: calibrationPath,
      DHEVALS_RELEASE_LEADERBOARD: candidateLeaderboard,
      DHEVALS_RELEASE_GATE_OUTPUT: candidateGate,
      DHEVALS_RELEASE_GATE_PUBLIC_OUTPUT: candidateGatePublic,
      DHEVALS_RELEASE_GATE_STRICT: '1',
    },
  })
  process.stdout.write(stagedGate.stdout || '')
  process.stderr.write(stagedGate.stderr || '')
  if (!existsSync(candidateGate)) {
    console.error(`Comparison staged release gate did not write ${candidateGate}`)
    process.exit(stagedGate.status ?? 2)
  }
  const stagedGatePayload = JSON.parse(readFileSync(candidateGate, 'utf8'))
  if (stagedGatePayload.status !== 'ready') {
    console.error('Comparison reports are archived but not promoted because the release gate is blocked.')
    console.log(JSON.stringify({ status: 'blocked', primary: primary.run_id, release_gate: candidateGate, errors: stagedGatePayload.errors || [] }, null, 2))
    process.exit(2)
  }

  const publicData = resolve(root, 'public/data')
  mkdirSync(publicData, { recursive: true })
  copyFileSync(primary.run, resolve(publicData, 'latest-run.json'))
  copyFileSync(primary.report, resolve(publicData, 'latest-report.json'))
  copyFileSync(resolve(runsDirectory, `${primary.run_id}.youtube.json`), resolve(publicData, 'latest-youtube-pack.json'))
  copyFileSync(resolve(runsDirectory, `${primary.run_id}.html`), resolve(publicData, 'latest-report.html'))
  copyFileSync(resolve(runsDirectory, `${primary.run_id}.csv`), resolve(publicData, 'latest-results.csv'))
  copyFileSync(primary.verification, resolve(publicData, 'latest-verification.json'))
  copyIfDifferent(auditPath, 'public/data/latest-audit.json')
  copyIfDifferent(calibrationPath, 'public/data/latest-calibration.json')
  copyFileSync(candidateLeaderboard, resolve(publicData, 'leaderboard.json'))

  const releaseGate = spawnSync(process.execPath, ['scripts/build-release-gate.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      DHEVALS_RELEASE_SUITE: suitePath,
      DHEVALS_RELEASE_RUN: 'public/data/latest-run.json',
      DHEVALS_RELEASE_REPORT: 'public/data/latest-report.json',
      DHEVALS_RELEASE_VERIFICATION: 'public/data/latest-verification.json',
      DHEVALS_RELEASE_AUDIT: auditPath,
      DHEVALS_RELEASE_CALIBRATION: calibrationPath,
      DHEVALS_RELEASE_LEADERBOARD: 'public/data/leaderboard.json',
      DHEVALS_RELEASE_GATE_STRICT: '1',
    },
  })
  process.stdout.write(releaseGate.stdout || '')
  process.stderr.write(releaseGate.stderr || '')
  if (releaseGate.status !== 0) process.exit(releaseGate.status ?? 1)

  for (const script of ['build-suite-catalog.mjs', 'build-run-catalog.mjs', 'build-model-catalog.mjs']) {
    const catalog = spawnSync(process.execPath, [`scripts/${script}`], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
    process.stdout.write(catalog.stdout || '')
    process.stderr.write(catalog.stderr || '')
    if (catalog.status !== 0) process.exit(catalog.status ?? 1)
  }
  for (const script of ['build-dataset-catalog.mjs', 'build-experiment-catalog.mjs', 'build-scorecard.mjs']) runDerived(script)
} else if (reportInputs.length) {
  runDerived('build-dataset-catalog.mjs')
  runDerived('build-experiment-catalog.mjs')
  console.log(`Comparison reports archived only for ${suiteManifest.id}@${suiteManifest.version}; set DHEVALS_COMPARISON_PROMOTE=1 to update public artifacts.`)
}

if (!outcomes.some((outcome) => outcome.status === 'completed')) process.exit(2)

function completionEndpoint(value) {
  const normalized = value.replace(/\/+$/, '')
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`
}

function safeEndpoint(value) {
  try {
    const parsed = new URL(value)
    parsed.username = ''
    parsed.password = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return value
  }
}

function loadPreflight(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function preflightIsFresh(preflight, maxAgeMs) {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return false
  const generatedAt = Date.parse(preflight?.generated_at || '')
  return Number.isFinite(generatedAt) && Date.now() - generatedAt <= maxAgeMs
}

function copyIfDifferent(sourcePath, destinationPath) {
  const source = resolve(root, sourcePath)
  const destination = resolve(root, destinationPath)
  if (source !== destination) copyFileSync(source, destination)
}

function runDerived(script) {
  const command = spawnSync(process.execPath, [`scripts/${script}`], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(command.stdout || '')
  process.stderr.write(command.stderr || '')
  if (command.status !== 0) process.exit(command.status ?? 1)
}
