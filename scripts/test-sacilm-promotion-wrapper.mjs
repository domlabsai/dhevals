import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suitePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json')
const fixturePath = resolve(root, 'benchmarks/suites/heavy-user-ptbr/v0.2/fixtures/sacilm-calibration-fixture.json')
const suite = JSON.parse(readFileSync(suitePath, 'utf8'))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const archiveDirectory = mkdtempSync(resolve(tmpdir(), 'dhevals-sacilm-promotion-'))
const publicPaths = [
  'public/data/latest-run.json',
  'public/data/latest-report.json',
  'public/data/latest-verification.json',
  'public/data/leaderboard.json',
  'public/data/latest-release-gate.json',
]
const publicBefore = new Map(publicPaths.map((path) => [path, readFileSync(resolve(root, path), 'utf8')]))
const promptToTask = new Map(suite.tasks.map((task) => [task.prompt, task.id]))
let requests = 0
let server

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
        const taskId = promptToTask.get(payload.messages?.[0]?.content)
        if (!taskId) throw new Error('unknown task prompt')
        requests += 1
        const output = fixture[taskId].output
        const body = JSON.stringify({
          model: payload.model,
          choices: [{ message: { content: output }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 20, completion_tokens: 20 },
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
  const child = spawn(process.execPath, ['scripts/run-sacilm.mjs'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DHEVALS_SACILM_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
      DHEVALS_SACILM_SKIP_PREFLIGHT: '1',
      DHEVALS_SACILM_MODEL_MANIFEST: 'benchmarks/models/sacilm/v0.1/model.json',
      DHEVALS_SACILM_PROMOTE: '1',
      DHEVALS_RUN_ID: 'wrapper-promotion-draft',
      DHEVALS_SACILM_RUNS_DIR: archiveDirectory,
      DHEVALS_LEADERBOARD_REPORT_DIRS: archiveDirectory,
    },
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  const status = await new Promise((resolveChild) => child.on('close', (code) => resolveChild(code ?? 1)))

  if (status !== 2) throw new Error(`expected blocked promotion exit 2, got ${status}: ${stderr || stdout}`)
  if (requests !== suite.tasks.length) throw new Error(`expected ${suite.tasks.length} model requests, got ${requests}`)

  const archivePath = resolve(archiveDirectory, 'wrapper-promotion-draft.json')
  const reportPath = resolve(archiveDirectory, 'wrapper-promotion-draft.report.json')
  const verificationPath = resolve(archiveDirectory, 'wrapper-promotion-draft.verification.json')
  const leaderboardPath = resolve(archiveDirectory, 'wrapper-promotion-draft.leaderboard.json')
  const gatePath = resolve(archiveDirectory, 'wrapper-promotion-draft.release-gate.json')
  const run = JSON.parse(readFileSync(archivePath, 'utf8'))
  const leaderboard = JSON.parse(readFileSync(leaderboardPath, 'utf8'))
  const gate = JSON.parse(readFileSync(gatePath, 'utf8'))
  if (run.summary?.coverage !== 1 || run.summary?.overall_score !== 1) throw new Error('staged run did not complete with full coverage and score')
  if (leaderboard.entries?.some((entry) => entry.provider === 'fixture')) throw new Error('staged public leaderboard included a fixture entry')
  if (leaderboard.entries?.length !== 1) throw new Error(`expected one staged real entry, got ${leaderboard.entries?.length}`)
  if (gate.status !== 'blocked' || !gate.errors.some((error) => /model manifest is not ready/i.test(error))) {
    throw new Error(`draft manifest did not block staged publication: ${JSON.stringify(gate.errors)}`)
  }
  for (const [path, before] of publicBefore) {
    const after = readFileSync(resolve(root, path), 'utf8')
    if (after !== before) throw new Error(`public baseline changed while promotion was blocked: ${path}`)
  }
  console.log(JSON.stringify({
    status: 'ready',
    requests,
    archive: archivePath,
    report: reportPath,
    verification: verificationPath,
    staged_gate: gatePath,
    public_baseline_unchanged: true,
    fixture_entries_filtered: true,
  }, null, 2))
} finally {
  server?.closeAllConnections?.()
  if (server) await new Promise((resolveClose) => server.close(resolveClose))
  rmSync(archiveDirectory, { recursive: true, force: true })
}
