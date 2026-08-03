import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json')
const fixturePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.2/fixtures/sacilm-calibration-fixture.json')
const suite = JSON.parse(readFileSync(suitePath, 'utf8'))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const archiveDirectory = mkdtempSync(resolve(tmpdir(), 'dhevals-comparison-promotion-'))
const runsDirectory = resolve(archiveDirectory, 'runs')
const preflightPath = resolve(archiveDirectory, 'preflight.json')
const preflightPublicPath = resolve(archiveDirectory, 'preflight-public.json')
const summaryPath = resolve(archiveDirectory, 'comparison.json')
const publicPaths = [
  'public/data/latest-run.json',
  'public/data/latest-report.json',
  'public/data/latest-verification.json',
  'public/data/comparison-execution-latest.json',
  'public/data/leaderboard.json',
  'public/data/latest-release-gate.json',
]
const publicBefore = new Map(publicPaths.map((path) => [path, readFileSync(resolve(root, path), 'utf8')]))
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
        const taskId = promptToTask.get(prompt)
        if (!taskId && !String(prompt || '').includes('DHEvals')) throw new Error('unknown task prompt')
        requests += 1
        const output = taskId ? fixture[taskId].output : 'DHEvals'
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
    DHEVALS_BASELINE_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
    DHEVALS_SACILM_PREFLIGHT_OUTPUT: preflightPath,
    DHEVALS_SACILM_PREFLIGHT_PUBLIC_OUTPUT: preflightPublicPath,
    DHEVALS_SACILM_MODEL_MANIFEST: 'benchmarks/models/sacilm/v0.1/model.json',
  }
  const preflight = await runNode('scripts/preflight-sacilm.mjs', commonEnv)
  if (preflight.status !== 0) throw new Error(`preflight exited ${preflight.status}: ${preflight.stderr || preflight.stdout}`)
  const comparison = await runNode('scripts/run-comparison.mjs', {
    ...commonEnv,
    DHEVALS_COMPARISON_PROMOTE: '1',
    DHEVALS_COMPARISON_RUNS_DIR: runsDirectory,
    DHEVALS_COMPARISON_REPORT_DIRS: runsDirectory,
    DHEVALS_COMPARISON_SUMMARY: summaryPath,
    DHEVALS_RUN_ID: 'comparison-promotion-draft',
  })
  if (comparison.status !== 2) throw new Error(`expected blocked comparison exit 2, got ${comparison.status}: ${comparison.stderr || comparison.stdout}`)
  if (requests !== suite.tasks.length * 2 + 1) throw new Error(`expected ${suite.tasks.length * 2 + 1} requests including preflight, got ${requests}`)
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  if (summary.outcomes.filter((outcome) => outcome.status === 'completed').length !== 2) throw new Error('comparison did not complete both local models')
  const gatePath = resolve(root, 'reports/comparisons/comparison-promotion-draft.release-gate.json')
  const gate = JSON.parse(readFileSync(gatePath, 'utf8'))
  if (gate.status !== 'blocked' || !gate.errors.some((error) => /model manifest is not ready/i.test(error))) throw new Error(`draft manifest did not block comparison promotion: ${JSON.stringify(gate.errors)}`)
  for (const [path, before] of publicBefore) {
    if (path === 'public/data/comparison-execution-latest.json') continue
    const after = readFileSync(resolve(root, path), 'utf8')
    if (after !== before) throw new Error(`public baseline changed while comparison promotion was blocked: ${path}`)
  }
  const comparisonContract = JSON.parse(readFileSync(resolve(root, 'public/data/comparison-execution-latest.json'), 'utf8'))
  if (comparisonContract.status !== 'ready' || comparisonContract.execution.completed_models !== 2) throw new Error('comparison archive contract was not materialized before the promotion gate')
  if (comparisonContract.models.some((model) => model.score !== null)) throw new Error('comparison archive contract exposed a score before the promotion gate')
  console.log(JSON.stringify({ status: 'ready', requests, completed_models: summary.outcomes.filter((outcome) => outcome.status === 'completed').map((outcome) => outcome.model_id), release_gate: gatePath, public_baseline_unchanged: true }, null, 2))
} finally {
  server?.closeAllConnections?.()
  if (server) await new Promise((resolveClose) => server.close(resolveClose))
  for (const [path, contents] of publicBefore) writeFileSync(resolve(root, path), contents, 'utf8')
  rmSync(archiveDirectory, { recursive: true, force: true })
  rmSync(resolve(root, 'reports/comparisons/comparison-promotion-draft.release-gate.json'), { force: true })
  rmSync(resolve(root, 'reports/comparisons/comparison-promotion-draft.release-gate-public.json'), { force: true })
  rmSync(resolve(root, 'reports/comparisons/comparison-promotion-draft.leaderboard.json'), { force: true })
}
