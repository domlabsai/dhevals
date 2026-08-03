import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json')
const fixturePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.3/fixtures/sacilm-calibration-fixture.json')
const suite = JSON.parse(readFileSync(suitePath, 'utf8'))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const modelManifest = JSON.parse(readFileSync(resolve(root, 'benchmarks/models/sacilm/v0.1/model.json'), 'utf8'))
const promptToTask = new Map(suite.tasks.map((task) => [task.prompt, task.id]))
const publicRunPath = resolve(root, 'public/data/latest-run.json')
const publicBefore = JSON.parse(readFileSync(publicRunPath, 'utf8'))
const archiveDirectory = mkdtempSync(resolve(tmpdir(), 'dhevals-sacilm-wrapper-'))
let requests = 0

const server = createServer((request, response) => {
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
      if (!taskId) throw new Error('unknown task prompt')
      requests += 1
      const output = fixture[taskId].output
      const body = JSON.stringify({ model: payload.model, choices: [{ message: { content: output }, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 20 } })
      response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), connection: 'close' })
      response.end(body)
    } catch (error) {
      const body = JSON.stringify({ error: String(error.message || error) })
      response.writeHead(400, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), connection: 'close' })
      response.end(body)
    }
  })
})

await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer))
const address = server.address()
const baseUrl = `http://127.0.0.1:${address.port}/v1`
const child = spawn(process.execPath, ['scripts/run-sacilm.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    DHEVALS_SACILM_BASE_URL: baseUrl,
    DHEVALS_SACILM_SKIP_PREFLIGHT: '1',
    DHEVALS_SACILM_SUITE_PATH: 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json',
    DHEVALS_SACILM_MODEL_MANIFEST: 'benchmarks/models/sacilm/v0.1/model.json',
    DHEVALS_SACILM_PROMOTE: '0',
    DHEVALS_RUN_ID: 'wrapper-archive-v03',
    DHEVALS_SACILM_RUNS_DIR: archiveDirectory,
  },
})
let stdout = ''
let stderr = ''
child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
const command = await new Promise((resolveChild) => {
  child.on('close', (code, signal) => resolveChild({ status: code ?? 1, signal, stdout, stderr }))
})
server.closeAllConnections?.()
await new Promise((resolveClose) => server.close(resolveClose))
const publicAfter = JSON.parse(readFileSync(publicRunPath, 'utf8'))
const archive = resolve(archiveDirectory, 'wrapper-archive-v03.json')
const report = resolve(archiveDirectory, 'wrapper-archive-v03.report.json')
const verification = resolve(archiveDirectory, 'wrapper-archive-v03.verification.json')
const run = JSON.parse(readFileSync(archive, 'utf8'))

try {
  if (command.status !== 0) throw new Error(`run:sacilm exited ${command.status}: ${command.stderr}`)
  if (requests !== suite.tasks.length) throw new Error(`expected ${suite.tasks.length} requests, got ${requests}`)
  if (!run.summary || run.summary.coverage !== 1 || run.summary.overall_score !== 1) throw new Error('archive run did not complete with full coverage and score')
  if (run.run?.model?.extra?.model_manifest?.id !== modelManifest.id) throw new Error('archive run did not embed the SaciLM model manifest')
  if (!/^[0-9a-f]{64}$/.test(run.run?.model?.extra?.model_manifest_hash || '')) throw new Error('archive run is missing the model manifest hash')
  if (publicAfter.run.id !== publicBefore.run.id) throw new Error('archive-only run changed public latest artifact')
  console.log(JSON.stringify({ status: 'ready', requests, coverage: run.summary.coverage, score: run.summary.overall_score, archive, report, verification, public_run_unchanged: true }, null, 2))
} finally {
  rmSync(archiveDirectory, { recursive: true, force: true })
}
