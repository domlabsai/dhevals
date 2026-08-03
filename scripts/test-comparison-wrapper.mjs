import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json')
const fixturePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.3/fixtures/sacilm-calibration-fixture.json')
const suite = JSON.parse(readFileSync(suitePath, 'utf8'))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const publicRunPath = resolve(root, 'public/data/latest-run.json')
const publicLeaderboardPath = resolve(root, 'public/data/leaderboard.json')
const publicComparisonPath = resolve(root, 'public/data/comparison-execution-latest.json')
const publicBefore = readFileSync(publicRunPath, 'utf8')
const leaderboardBefore = readFileSync(publicLeaderboardPath, 'utf8')
const comparisonBefore = existsSync(publicComparisonPath) ? readFileSync(publicComparisonPath, 'utf8') : null
const directory = mkdtempSync(resolve(tmpdir(), 'dhevals-comparison-wrapper-'))
const runsDirectory = resolve(directory, 'runs')
const summaryPath = resolve(directory, 'comparison.json')
const preflightPath = resolve(directory, 'preflight.json')
const preflightPublicPath = resolve(directory, 'preflight-public.json')
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
  const promptToTask = new Map(suite.tasks.map((task) => [task.prompt, task.id]))
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
        response.writeHead(400, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), connection: 'close' })
        response.end(body)
      }
    })
  })
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer))
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}/v1`
  const commonEnv = {
    ...process.env,
    DHEVALS_SACILM_BASE_URL: baseUrl,
    DHEVALS_BASELINE_BASE_URL: baseUrl,
    DHEVALS_SACILM_PREFLIGHT_OUTPUT: preflightPath,
    DHEVALS_SACILM_PREFLIGHT_PUBLIC_OUTPUT: preflightPublicPath,
    DHEVALS_SACILM_MODEL_MANIFEST: 'benchmarks/models/sacilm/v0.1/model.json',
  }
  const preflight = await runNode('scripts/preflight-sacilm.mjs', commonEnv)
  if (preflight.status !== 0) {
    const diagnostic = readFileSync(preflightPath, 'utf8')
    throw new Error(`preflight exited ${preflight.status}: ${diagnostic}`)
  }
  const comparison = await runNode('scripts/run-comparison.mjs', {
    ...commonEnv,
    DHEVALS_COMPARISON_REGISTRY: 'benchmarks/comparisons/v0.3/models.json',
    DHEVALS_COMPARISON_SUITE: 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json',
    DHEVALS_COMPARISON_RUNS_DIR: runsDirectory,
    DHEVALS_COMPARISON_SUMMARY: summaryPath,
    DHEVALS_RUN_ID: 'comparison-wrapper-v03',
  })
  if (comparison.status !== 0) throw new Error(`run-comparison exited ${comparison.status}: ${comparison.stderr || comparison.stdout}`)
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  const completed = summary.outcomes.filter((outcome) => outcome.status === 'completed')
  if (completed.length !== 2) throw new Error(`expected two completed models, got ${completed.length}`)
  if (summary.report_inputs.length !== 2) throw new Error(`expected two verified reports, got ${summary.report_inputs.length}`)
  if (requests !== suite.tasks.length * 2 + 1) throw new Error(`expected ${suite.tasks.length * 2 + 1} requests including preflight, got ${requests}`)
  const sacilmRun = JSON.parse(readFileSync(resolve(runsDirectory, 'comparison-wrapper-v03-sacilm.json'), 'utf8'))
  if (sacilmRun.run.model.extra?.model_manifest?.id !== 'sacilm') throw new Error('SaciLM comparison run is missing model manifest')
  if (readFileSync(publicRunPath, 'utf8') !== publicBefore) throw new Error('archive-only comparison changed public latest run')
  if (readFileSync(publicLeaderboardPath, 'utf8') !== leaderboardBefore) throw new Error('archive-only comparison changed public leaderboard')
  const comparisonContract = JSON.parse(readFileSync(publicComparisonPath, 'utf8'))
  if (comparisonContract.status !== 'ready' || comparisonContract.execution.completed_models !== 2) throw new Error('comparison execution contract did not record both archive lanes')
  if (comparisonContract.models.some((model) => model.score !== null || model.score_status !== 'locked_until_release_gate')) throw new Error('comparison execution contract exposed a score before release')
  if (JSON.stringify(comparisonContract).includes(directory)) throw new Error('comparison execution contract leaked the temporary directory')
  console.log(JSON.stringify({ status: 'ready', requests, completed_models: completed.map((outcome) => outcome.model_id), reports: summary.report_inputs.length, archive_only: true }, null, 2))
} finally {
  server?.closeAllConnections?.()
  if (server) await new Promise((resolveClose) => server.close(resolveClose))
  if (comparisonBefore === null) rmSync(publicComparisonPath, { force: true })
  else writeFileSync(publicComparisonPath, comparisonBefore, 'utf8')
  rmSync(directory, { recursive: true, force: true })
}
