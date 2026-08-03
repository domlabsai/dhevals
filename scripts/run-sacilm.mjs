import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { verifyRunArtifact } from './verify-run.mjs'
import { resolveSacilmManifestPath } from './sacilm-manifest-path.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const baseUrl = process.env.DHEVALS_SACILM_BASE_URL
const apiKeyEnv = process.env.DHEVALS_SACILM_API_KEY_ENV || 'DHEVALS_SACILM_API_KEY'
const modelId = process.env.DHEVALS_SACILM_MODEL_ID || 'sacilm'
const provider = process.env.DHEVALS_SACILM_PROVIDER || 'runpod-openai-compatible'
const suitePath = process.env.DHEVALS_SACILM_SUITE_PATH || 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json'
const suiteAbsolutePath = resolve(root, suitePath)
const suiteManifest = _readJson(suiteAbsolutePath, 'suite manifest')
const modelManifestPath = resolveSacilmManifestPath(root, process.env.DHEVALS_SACILM_MODEL_MANIFEST)
const modelManifestAbsolutePath = resolve(root, modelManifestPath)
const modelManifest = _readJson(modelManifestAbsolutePath, 'SaciLM model manifest')
const suiteVersion = suiteManifest.version || 'unknown'
const defaultSuitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json')
const explicitlyPromote = process.env.DHEVALS_SACILM_PROMOTE === '1'
const explicitlyArchive = process.env.DHEVALS_SACILM_PROMOTE === '0'
const isDefaultSuite = suiteAbsolutePath === defaultSuitePath
const promote = explicitlyPromote || (!explicitlyArchive && isDefaultSuite)
const temperature = process.env.DHEVALS_SACILM_TEMPERATURE || '0.2'
const maxTokens = process.env.DHEVALS_SACILM_MAX_TOKENS || '2048'
const seed = process.env.DHEVALS_SACILM_SEED || '7'
const preflightMaxAgeMs = Number(process.env.DHEVALS_SACILM_PREFLIGHT_MAX_AGE_MS || 6 * 60 * 60 * 1000)
const inputCostPer1k = process.env.DHEVALS_SACILM_INPUT_COST_PER_1K
const outputCostPer1k = process.env.DHEVALS_SACILM_OUTPUT_COST_PER_1K
const runId = process.env.DHEVALS_RUN_ID || `sacilm-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const preflightOutput = resolve(root, process.env.DHEVALS_SACILM_PREFLIGHT_OUTPUT || 'reports/preflight/sacilm-latest.json')
const runsDirectory = resolve(root, process.env.DHEVALS_SACILM_RUNS_DIR || 'reports/runs')
const archiveOutput = resolve(runsDirectory, `${runId}.json`)
const verificationOutput = resolve(runsDirectory, `${runId}.verification.json`)
const reportOutput = resolve(runsDirectory, `${runId}.report.json`)
const youtubeOutput = resolve(runsDirectory, `${runId}.youtube.json`)
const htmlOutput = resolve(runsDirectory, `${runId}.html`)
const csvOutput = resolve(runsDirectory, `${runId}.csv`)

if (!baseUrl) {
  console.error('Missing DHEVALS_SACILM_BASE_URL (expected an OpenAI-compatible /v1 endpoint).')
  process.exit(2)
}
if (!existsSync(modelManifestAbsolutePath)) {
  console.error(`Missing SaciLM model manifest at ${modelManifestAbsolutePath}`)
  process.exit(2)
}

if (!isDefaultSuite && !explicitlyPromote && !explicitlyArchive) {
  console.log(`Suite ${suiteManifest.id}@${suiteVersion} is archive-only by default; set DHEVALS_SACILM_PROMOTE=1 to replace public latest artifacts.`)
}

if (process.env.DHEVALS_SACILM_SKIP_PREFLIGHT !== '1') {
  const preflight = _loadPreflight(preflightOutput)
  if (!preflight || preflight.status !== 'ready') {
    console.error(`SaciLM preflight is not ready; run npm run preflight:sacilm first (expected ${preflightOutput}).`)
    process.exit(2)
  }
  if (!_preflightIsFresh(preflight, preflightMaxAgeMs)) {
    console.error(`SaciLM preflight is older than ${Math.round(preflightMaxAgeMs / 3600000)}h; run npm run preflight:sacilm again.`)
    process.exit(2)
  }
  if (preflight.model?.model_id && preflight.model.model_id !== modelId) {
    console.error(`SaciLM preflight model ${preflight.model.model_id} does not match requested ${modelId}.`)
    process.exit(2)
  }
  if (preflight.model_manifest?.id && preflight.model_manifest.id !== modelManifest.id) {
    console.error('SaciLM preflight model manifest does not match the requested manifest.')
    process.exit(2)
  }
  if (preflight.model_manifest?.version && preflight.model_manifest.version !== modelManifest.version) {
    console.error('SaciLM preflight model manifest version does not match the requested manifest.')
    process.exit(2)
  }
  const expectedEndpoint = _safeEndpoint(_completionEndpoint(baseUrl))
  if (preflight.endpoint && preflight.endpoint !== expectedEndpoint) {
    console.error('SaciLM preflight endpoint does not match DHEVALS_SACILM_BASE_URL.')
    process.exit(2)
  }
}

mkdirSync(runsDirectory, { recursive: true })
const args = [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-run',
  '--suite', suitePath,
  '--base-url', baseUrl,
  '--api-key-env', apiKeyEnv,
  '--provider', provider,
  '--model-id', modelId,
  '--temperature', temperature,
  '--max-tokens', maxTokens,
  '--seed', seed,
  '--model-manifest', modelManifestPath,
  '--run-id', runId,
  '--output', archiveOutput,
]
if (inputCostPer1k) args.push('--input-cost-per-1k', inputCostPer1k)
if (outputCostPer1k) args.push('--output-cost-per-1k', outputCostPer1k)
for (const [environmentKey, argument] of [
  ['DHEVALS_SACILM_CHECKPOINT', '--checkpoint'],
  ['DHEVALS_SACILM_RUNTIME', '--runtime'],
  ['DHEVALS_SACILM_TRAINING_COMMIT', '--training-commit'],
]) {
  if (process.env[environmentKey]) args.push(argument, process.env[environmentKey])
}

const command = spawnSync('uv', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(command.stdout || '')
process.stderr.write(command.stderr || '')
if (command.status !== 0) process.exit(command.status ?? 1)
if (!existsSync(archiveOutput)) {
  console.error(`Runner completed without writing ${archiveOutput}`)
  process.exit(2)
}

const runVerification = verifyRunArtifact({ artifactPath: archiveOutput, suitePath: suiteAbsolutePath, outputPath: verificationOutput })
if (runVerification !== 0) {
  console.error('SaciLM run failed reproducibility verification; refusing to publish or archive it.')
  process.exit(runVerification)
}

const reportBuild = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-report',
  '--input', archiveOutput,
  '--report-output', reportOutput,
  '--youtube-output', youtubeOutput,
  '--html-output', htmlOutput,
  '--csv-output', csvOutput,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(reportBuild.stdout || '')
process.stderr.write(reportBuild.stderr || '')
if (reportBuild.status !== 0) process.exit(reportBuild.status ?? 1)

const reportVerification = verifyRunArtifact({ artifactPath: archiveOutput, suitePath: suiteAbsolutePath, reportPath: reportOutput, outputPath: verificationOutput })
if (reportVerification !== 0) {
  console.error('SaciLM derived report failed reproducibility verification; refusing to publish or archive it.')
  process.exit(reportVerification)
}

if (promote) {
  _promoteToPublic()
} else {
  _runDerivedScript('scripts/build-dataset-catalog.mjs')
  _runDerivedScript('scripts/build-experiment-catalog.mjs')
  console.log(JSON.stringify({
    status: 'archived',
    suite_id: suiteManifest.id,
    suite_version: suiteVersion,
    run_id: runId,
    coverage: _readJson(archiveOutput, 'run artifact').summary?.coverage ?? null,
    report: reportOutput,
    reason: 'suite is not the public baseline or DHEVALS_SACILM_PROMOTE=0',
  }, null, 2))
}

function _promoteToPublic() {
  const publicData = resolve(root, 'public/data')
  mkdirSync(publicData, { recursive: true })

  // Stage every derived artifact outside public/data first. The release gate
  // is the publication transaction: a draft manifest, pending calibration,
  // stale audit, or mismatched leaderboard must leave the previous public
  // baseline untouched.
  const auditPath = process.env.DHEVALS_SACILM_AUDIT_PATH || 'public/data/latest-audit.json'
  const calibrationPath = process.env.DHEVALS_SACILM_CALIBRATION_PATH || 'public/data/latest-calibration.json'
  const candidateLeaderboard = resolve(runsDirectory, `${runId}.leaderboard.json`)
  const candidateGate = resolve(runsDirectory, `${runId}.release-gate.json`)
  const candidateGatePublic = resolve(runsDirectory, `${runId}.release-gate-public.json`)

  const leaderboard = spawnSync(process.execPath, ['scripts/build-leaderboard.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      DHEVALS_LEADERBOARD_SUITE: suitePath,
      DHEVALS_LEADERBOARD_OUTPUT: candidateLeaderboard,
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
      DHEVALS_RELEASE_RUN: archiveOutput,
      DHEVALS_RELEASE_REPORT: reportOutput,
      DHEVALS_RELEASE_VERIFICATION: verificationOutput,
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
    console.error(`Staged release gate did not write ${candidateGate}`)
    process.exit(stagedGate.status ?? 2)
  }
  const stagedGatePayload = _readJson(candidateGate, 'staged release gate')
  if (stagedGatePayload.status !== 'ready') {
    console.error('SaciLM run is archived but not promoted because the release gate is blocked.')
    console.log(JSON.stringify({
      status: 'blocked',
      suite_id: suiteManifest.id,
      suite_version: suiteVersion,
      run_id: runId,
      archive: archiveOutput,
      report: reportOutput,
      release_gate: candidateGate,
      errors: stagedGatePayload.errors || [],
    }, null, 2))
    process.exit(2)
  }

  copyFileSync(archiveOutput, resolve(publicData, 'latest-run.json'))
  copyFileSync(reportOutput, resolve(publicData, 'latest-report.json'))
  copyFileSync(youtubeOutput, resolve(publicData, 'latest-youtube-pack.json'))
  copyFileSync(htmlOutput, resolve(publicData, 'latest-report.html'))
  copyFileSync(csvOutput, resolve(publicData, 'latest-results.csv'))
  copyFileSync(verificationOutput, resolve(publicData, 'latest-verification.json'))
  _copyIfDifferent(auditPath, 'public/data/latest-audit.json')
  _copyIfDifferent(calibrationPath, 'public/data/latest-calibration.json')
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

  const catalog = spawnSync(process.execPath, ['scripts/build-suite-catalog.mjs'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(catalog.stdout || '')
  process.stderr.write(catalog.stderr || '')
  if (catalog.status !== 0) process.exit(catalog.status ?? 1)
  const runCatalog = spawnSync(process.execPath, ['scripts/build-run-catalog.mjs'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(runCatalog.stdout || '')
  process.stderr.write(runCatalog.stderr || '')
  if (runCatalog.status !== 0) process.exit(runCatalog.status ?? 1)
  const modelCatalog = spawnSync(process.execPath, ['scripts/build-model-catalog.mjs'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(modelCatalog.stdout || '')
  process.stderr.write(modelCatalog.stderr || '')
  if (modelCatalog.status !== 0) process.exit(modelCatalog.status ?? 1)
  _runDerivedScript('scripts/build-dataset-catalog.mjs')
  _runDerivedScript('scripts/build-experiment-catalog.mjs')
  _runDerivedScript('scripts/build-scorecard.mjs')
  console.log(JSON.stringify({
    status: 'promoted',
    suite_id: suiteManifest.id,
    suite_version: suiteVersion,
    run_id: runId,
    public_run: 'public/data/latest-run.json',
    report: reportOutput,
    release_gate: 'public/data/latest-release-gate.json',
  }, null, 2))
}

function _runDerivedScript(script) {
  const command = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(command.stdout || '')
  process.stderr.write(command.stderr || '')
  if (command.status !== 0) process.exit(command.status ?? 1)
}

function _completionEndpoint(value) {
  const normalized = value.replace(/\/+$/, '')
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`
}

function _safeEndpoint(value) {
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

function _loadPreflight(path) {
  if (!existsSync(path)) return null
  try {
    return _readJson(path, 'preflight')
  } catch {
    return null
  }
}

function _preflightIsFresh(preflight, maxAgeMs) {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return false
  const generatedAt = Date.parse(preflight?.generated_at || '')
  return Number.isFinite(generatedAt) && Date.now() - generatedAt <= maxAgeMs
}

function _readJson(path, label) {
  try {
    const payload = JSON.parse(readFileSync(path, 'utf8'))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('expected an object')
    return payload
  } catch (error) {
    console.error(`Unable to read ${label} at ${path}: ${error.message}`)
    process.exit(2)
  }
}

function _copyIfDifferent(sourcePath, destinationPath) {
  const source = resolve(root, sourcePath)
  const destination = resolve(root, destinationPath)
  if (source !== destination) copyFileSync(source, destination)
}
