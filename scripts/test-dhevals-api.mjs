import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

for (const script of ['scripts/run-test-matrix.mjs', 'scripts/check-sacilm-readiness.mjs', 'scripts/build-dataset-catalog.mjs', 'scripts/build-experiment-catalog.mjs', 'scripts/build-scorecard.mjs']) {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '')
    process.stderr.write(result.stderr || '')
    process.exit(result.status ?? 1)
  }
}

const port = await freePort()
const child = spawn(process.execPath, ['scripts/dhevals-api-server.mjs'], {
  cwd: root,
  env: { ...process.env, DHEVALS_API_PORT: String(port), DHEVALS_API_HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let stderr = ''
child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
try {
  await waitForHealth(port)
  const routeAssertions = [
    ['/healthz', null],
    ['/api/v1/runs/latest', null],
    ['/api/v1/reports/latest', 'dhevals_report'],
    ['/api/v1/reports/youtube/latest', 'dhevals_youtube_pack'],
    ['/api/v1/runs', 'dhevals_run_catalog'],
    ['/api/v1/models', 'dhevals_model_catalog'],
    ['/api/v1/suites', 'dhevals_suite_catalog'],
    ['/api/v1/datasets', 'dhevals_dataset_catalog'],
    ['/api/v1/scorecards/latest', 'dhevals_scorecard'],
    ['/api/v1/judge/latest', 'dhevals_judge_artifact'],
    ['/api/v1/calibration', null],
    ['/api/v1/calibration/v0.3/handoff', 'dhevals_calibration_handoff'],
    ['/api/v1/experiments', 'dhevals_experiment_catalog'],
    ['/api/v1/comparisons/latest', 'dhevals_comparison_execution'],
    ['/api/v1/test-matrices', 'dhevals_test_matrix_catalog'],
    ['/api/v1/test-executions/latest', 'dhevals_test_execution'],
    ['/api/v1/leaderboard', 'dhevals_leaderboard'],
    ['/api/v1/release-gate', 'dhevals_release_gate'],
    ['/api/v1/readiness/sacilm', 'dhevals_sacilm_readiness'],
    ['/api/v1/readiness/dhevals', 'dhevals_goal_audit'],
  ]
  for (const [path, expectedKind] of routeAssertions) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`)
    if (!response.ok) throw new Error(`${path} returned ${response.status}`)
    const payload = await response.json()
    if (path === '/healthz' && payload.service !== 'dhevals-api') throw new Error(`${path} health payload mismatch`)
    if (path === '/api/v1/runs/latest' && !payload.run?.id) throw new Error(`${path} run payload mismatch`)
    if (expectedKind && payload.kind !== expectedKind) throw new Error(`${path} kind mismatch: ${payload.kind}`)
    if (path === '/api/v1/test-executions/latest' && payload.coverage?.scorecard_dimension_count !== 14) throw new Error(`${path} scorecard coverage mismatch`)
    const serialized = JSON.stringify(payload)
    if (/(?:["'](?:api[_-]?key|authorization|password|client[_-]?secret|access[_-]?token)["']\s*:\s*["'][^"']+|bearer\s+[A-Za-z0-9._-]+)/i.test(serialized)) throw new Error(`${path} contains a credential-looking value`)
  }
  const post = await fetch(`http://127.0.0.1:${port}/api/v1/runs`, { method: 'POST' })
  if (post.status !== 405) throw new Error(`write guard returned ${post.status}`)
  const missing = await fetch(`http://127.0.0.1:${port}/api/v1/nope`)
  if (missing.status !== 404) throw new Error(`404 guard returned ${missing.status}`)
  console.log(JSON.stringify({ status: 'passed', routes: routeAssertions.length, port }, null, 2))
} finally {
  child.kill('SIGTERM')
  await new Promise((resolvePromise) => child.once('exit', resolvePromise))
  if (stderr.trim()) process.stderr.write(stderr)
}

async function waitForHealth(portNumber) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${portNumber}/healthz`)
      if (response.ok) return
    } catch {
      // Server is still binding.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
  }
  throw new Error('API did not become healthy')
}

function freePort() {
  return new Promise((resolvePromise, reject) => {
    const socket = createServer()
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', () => {
      const portNumber = socket.address().port
      socket.close(() => resolvePromise(portNumber))
    })
  })
}
