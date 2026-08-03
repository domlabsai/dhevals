import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// This is an offline contract test, not a fabricated SaciLM result.  It uses
// the same OpenAI-compatible HTTP boundary as RunPod and deliberately keeps
// every generated artifact in a temporary directory.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json')
const fixturePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.3/fixtures/sacilm-calibration-fixture.json')
const publicRunPath = resolve(root, 'public/data/latest-run.json')
const suite = JSON.parse(readFileSync(suitePath, 'utf8'))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const publicBefore = readFileSync(publicRunPath, 'utf8')
const directory = mkdtempSync(resolve(tmpdir(), 'dhevals-sacilm-e2e-'))
const preflightOutput = resolve(directory, 'preflight.json')
const preflightPublicOutput = resolve(directory, 'public-preflight.json')
const runsDirectory = resolve(directory, 'runs')
const promptToTask = new Map(suite.tasks.map((task) => [task.prompt, task.id]))
let requests = 0
let server

function runNode(script, env) {
  return new Promise((resolveChild) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('close', (code, signal) => resolveChild({ status: code ?? 1, signal, stdout, stderr }))
  })
}

try {
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
        // The preflight prompt is intentionally accepted as a separate smoke
        // request and does not count as one of the suite task requests.
        const taskId = promptToTask.get(prompt)
        const output = taskId ? fixture[taskId].output : 'DHEvals'
        requests += taskId ? 1 : 0
        const body = JSON.stringify({
          model: payload.model,
          choices: [{ message: { content: output }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 20, completion_tokens: 20, total_tokens: 40 },
        })
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
  const baseUrl = `http://127.0.0.1:${address.port}/v1`
  const env = {
    ...process.env,
    DHEVALS_SACILM_BASE_URL: baseUrl,
    DHEVALS_SACILM_PREFLIGHT_OUTPUT: preflightOutput,
    DHEVALS_SACILM_PREFLIGHT_PUBLIC_OUTPUT: preflightPublicOutput,
    DHEVALS_SACILM_SUITE_PATH: 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json',
    DHEVALS_SACILM_MODEL_MANIFEST: 'benchmarks/models/sacilm/v0.1/model.json',
    DHEVALS_SACILM_PROMOTE: '0',
    DHEVALS_RUN_ID: 'wrapper-preflight-e2e-v03',
    DHEVALS_SACILM_RUNS_DIR: runsDirectory,
  }

  const preflightResult = await runNode('scripts/preflight-sacilm.mjs', env)
  if (preflightResult.status !== 0) throw new Error(`preflight:sacilm E2E exited ${preflightResult.status}: ${preflightResult.stderr || preflightResult.stdout}`)
  const result = await runNode('scripts/run-sacilm.mjs', env)
  const preflight = JSON.parse(readFileSync(preflightOutput, 'utf8'))
  const archivePath = resolve(runsDirectory, 'wrapper-preflight-e2e-v03.json')
  const verificationPath = resolve(runsDirectory, 'wrapper-preflight-e2e-v03.verification.json')
  const reportPath = resolve(runsDirectory, 'wrapper-preflight-e2e-v03.report.json')
  const archive = JSON.parse(readFileSync(archivePath, 'utf8'))

  if (result.status !== 0) throw new Error(`run:sacilm E2E exited ${result.status}: ${result.stderr || result.stdout}`)
  if (preflight.status !== 'ready' || !preflight.checks?.every((check) => check.passed)) throw new Error('preflight did not produce a ready contract')
  if (requests !== suite.tasks.length) throw new Error(`expected ${suite.tasks.length} task requests after preflight, got ${requests}`)
  if (archive.summary?.coverage !== 1 || archive.summary?.overall_score !== 1) throw new Error('full E2E archive did not complete with coverage 1 and score 1')
  if (archive.run?.model?.extra?.model_manifest?.id !== 'sacilm') throw new Error('full E2E archive did not embed the manifest identity')
  if (readFileSync(publicRunPath, 'utf8') !== publicBefore) throw new Error('archive-only E2E changed the public baseline')
  console.log(JSON.stringify({
    status: 'ready',
    preflight: preflight.status,
    requests,
    coverage: archive.summary.coverage,
    score: archive.summary.overall_score,
    archive: archivePath,
    report: reportPath,
    verification: verificationPath,
    public_run_unchanged: true,
  }, null, 2))
} finally {
  server?.closeAllConnections?.()
  if (server) await new Promise((resolveClose) => server.close(resolveClose))
  rmSync(directory, { recursive: true, force: true })
}
