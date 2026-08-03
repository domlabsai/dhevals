import { createServer } from 'node:http'
import { lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json')
const fixturePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.2/fixtures/sacilm-calibration-fixture.json')
const sourceManifestPath = resolve(root, 'benchmarks/models/sacilm/v0.1/model.json')
const suite = JSON.parse(readFileSync(suitePath, 'utf8'))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const archiveDirectory = mkdtempSync(resolve(tmpdir(), 'dhevals-sacilm-promotion-ready-'))
const modelManifestPath = resolve(archiveDirectory, 'sacilm-ready.json')
const calibrationPath = resolve(archiveDirectory, 'calibration-ready.json')
const calibrationSummaryPath = resolve(archiveDirectory, 'calibration-summary-ready.json')
const preflightPath = resolve(archiveDirectory, 'preflight.json')
const preflightPublicPath = resolve(archiveDirectory, 'preflight-public.json')
const publicDirectory = resolve(root, 'public/data')
const publicBefore = new Map(readdirSync(publicDirectory).filter((file) => lstatSync(resolve(publicDirectory, file)).isFile()).map((file) => [file, readFileSync(resolve(publicDirectory, file), 'utf8')]))
const releasePath = resolve(root, 'reports/release/latest.json')
const releaseBefore = readFileSync(releasePath, 'utf8')
const promptToTask = new Map(suite.tasks.map((task) => [task.prompt, task.id]))
let requests = 0
let server

const runNode = (script, env) => new Promise((resolveChild) => {
  const child = spawn(process.execPath, [script], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  child.on('close', (code) => resolveChild({ status: code ?? 1, stdout, stderr }))
})

function restorePublic() {
  const current = new Set(readdirSync(publicDirectory).filter((file) => lstatSync(resolve(publicDirectory, file)).isFile()))
  for (const file of current) {
    if (!publicBefore.has(file)) rmSync(resolve(publicDirectory, file), { force: true })
  }
  for (const [file, contents] of publicBefore) writeFileSync(resolve(publicDirectory, file), contents, 'utf8')
  writeFileSync(releasePath, releaseBefore, 'utf8')
}

try {
  const readyManifest = JSON.parse(readFileSync(sourceManifestPath, 'utf8'))
  readyManifest.status = 'ready'
  readyManifest.base_model.id = 'local-test-base'
  readyManifest.base_model.license = 'apache-2.0'
  readyManifest.checkpoint.id = 'local-test-checkpoint'
  readyManifest.checkpoint.revision = 'git:local-test'
  readyManifest.checkpoint.sha256 = 'a'.repeat(64)
  readyManifest.post_training.quantization = '4bit-nf4'
  readyManifest.post_training.training_commit = 'git:local-training'
  readyManifest.post_training.dataset.sha256 = 'b'.repeat(64)
  readyManifest.post_training.dataset.license = 'internal-reviewed'
  readyManifest.post_training.config.lora = 'r=16-alpha=32'
  readyManifest.post_training.config.sequence_length = 4096
  readyManifest.post_training.config.packing = true
  readyManifest.training_runtime.hardware = 'local-test'
  readyManifest.training_runtime.image = 'local/test-image@sha256:' + 'c'.repeat(64)
  writeFileSync(modelManifestPath, JSON.stringify(readyManifest, null, 2) + '\n', 'utf8')

  const calibration = JSON.parse(readFileSync(resolve(root, 'public/data/latest-calibration.json'), 'utf8'))
  calibration.status = 'ready'
  calibration.ready = true
  calibration.completed_groups = calibration.required_groups
  calibration.missing_groups = []
  calibration.disagreement_groups = []
  writeFileSync(calibrationPath, JSON.stringify(calibration, null, 2) + '\n', 'utf8')

  const calibrationSummary = JSON.parse(readFileSync(resolve(root, 'reports/calibration/heavy-user-ptbr-v0.2-summary.json'), 'utf8'))
  calibrationSummary.status = 'ready'
  calibrationSummary.completed_groups = calibrationSummary.required_groups
  calibrationSummary.missing_groups = []
  calibrationSummary.disagreement_groups = []
  writeFileSync(calibrationSummaryPath, JSON.stringify(calibrationSummary, null, 2) + '\n', 'utf8')

  server = createServer((request, response) => {
    if (request.method !== 'POST' || !request.url?.endsWith('/chat/completions')) {
      response.writeHead(404)
      response.end()
      return
    }
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const prompt = payload.messages?.[0]?.content
        const taskId = promptToTask.get(prompt)
        // The readiness probe uses a deliberately separate one-shot prompt.
        const output = taskId ? fixture[taskId].output : String(prompt || '').includes('DHEvals') ? 'DHEvals' : null
        if (output === null) throw new Error('unknown task prompt')
        requests += taskId ? 1 : 0
        const body = JSON.stringify({ model: payload.model, choices: [{ message: { content: output }, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 20 } })
        response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), connection: 'close' })
        response.end(body)
      } catch (error) {
        const body = JSON.stringify({ error: String(error.message || error) })
        response.writeHead(400, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
        response.end(body)
      }
    })
  })
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer))
  const address = server.address()
  const commonEnv = {
    ...process.env,
    DHEVALS_SACILM_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
    DHEVALS_SACILM_PREFLIGHT_OUTPUT: preflightPath,
    DHEVALS_SACILM_PREFLIGHT_PUBLIC_OUTPUT: preflightPublicPath,
    DHEVALS_SACILM_PROMOTE: '1',
    DHEVALS_SACILM_MODEL_MANIFEST: modelManifestPath,
    DHEVALS_SACILM_CALIBRATION_PATH: calibrationPath,
    DHEVALS_CALIBRATION_SUMMARY: calibrationSummaryPath,
    DHEVALS_LEADERBOARD_REPORT_DIRS: archiveDirectory,
    DHEVALS_RUN_ID: 'wrapper-promotion-ready',
    DHEVALS_SACILM_RUNS_DIR: archiveDirectory,
  }
  const preflight = await runNode('scripts/preflight-sacilm.mjs', commonEnv)
  if (preflight.status !== 0) throw new Error(`ready promotion preflight exited ${preflight.status}: ${preflight.stderr || preflight.stdout}`)
  const preflightArtifact = JSON.parse(readFileSync(preflightPath, 'utf8'))
  if (preflightArtifact.status !== 'ready' || !preflightArtifact.checks?.every((check) => check.passed)) throw new Error('ready promotion preflight was not ready')
  const run = await runNode('scripts/run-sacilm.mjs', commonEnv)
  if (run.status !== 0) throw new Error(`ready promotion exited ${run.status}: ${run.stderr || run.stdout}`)
  if (requests !== suite.tasks.length) throw new Error(`expected ${suite.tasks.length} model requests, got ${requests}`)

  const latestRun = JSON.parse(readFileSync(resolve(publicDirectory, 'latest-run.json'), 'utf8'))
  const latestLeaderboard = JSON.parse(readFileSync(resolve(publicDirectory, 'leaderboard.json'), 'utf8'))
  const latestGate = JSON.parse(readFileSync(resolve(publicDirectory, 'latest-release-gate.json'), 'utf8'))
  if (latestRun.run?.id !== 'wrapper-promotion-ready') throw new Error('ready promotion did not update latest run')
  if (latestLeaderboard.status !== 'ready' || latestLeaderboard.entries?.length !== 1) throw new Error('ready promotion did not publish a clean leaderboard')
  if (latestGate.status !== 'ready') throw new Error(`ready promotion did not publish a ready release gate: ${JSON.stringify(latestGate.errors)}`)
  console.log(JSON.stringify({ status: 'ready', preflight: preflightArtifact.status, requests, public_run: latestRun.run.id, leaderboard: latestLeaderboard.status, release_gate: latestGate.status }, null, 2))
} finally {
  server?.closeAllConnections?.()
  if (server) await new Promise((resolveClose) => server.close(resolveClose))
  restorePublic()
  rmSync(archiveDirectory, { recursive: true, force: true })
}
