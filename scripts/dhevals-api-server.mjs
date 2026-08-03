import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dataRoot = resolve(root, process.env.DHEVALS_API_DATA_ROOT || 'public/data')
const host = process.env.DHEVALS_API_HOST || '127.0.0.1'
const port = Number(process.env.DHEVALS_API_PORT || process.env.PORT || 8787)

const routes = new Map([
  ['/api/v1/runs/latest', 'latest-run.json'],
  ['/api/v1/reports/latest', 'latest-report.json'],
  ['/api/v1/reports/youtube/latest', 'latest-youtube-pack.json'],
  ['/api/v1/runs', 'run-catalog.json'],
  ['/api/v1/models', 'model-catalog.json'],
  ['/api/v1/suites', 'suite-catalog.json'],
  ['/api/v1/datasets', 'dataset-catalog.json'],
  ['/api/v1/scorecards/latest', 'latest-scorecard.json'],
  ['/api/v1/judge/latest', 'latest-judge.json'],
  ['/api/v1/calibration', 'latest-calibration.json'],
  ['/api/v1/calibration/v0.3/handoff', 'calibration/v0.3/handoff.json'],
  ['/api/v1/experiments', 'experiment-catalog.json'],
  ['/api/v1/comparisons/latest', 'comparison-execution-latest.json'],
  ['/api/v1/test-matrices', 'test-matrix-catalog.json'],
  ['/api/v1/test-executions/latest', 'test-execution-latest.json'],
  ['/api/v1/leaderboard', 'leaderboard.json'],
  ['/api/v1/release-gate', 'latest-release-gate.json'],
  ['/api/v1/readiness/sacilm', 'latest-sacilm-readiness.json'],
  ['/api/v1/readiness/dhevals', 'latest-goal-audit.json'],
])

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`)
  setCors(response)
  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    writeJson(response, 405, { error: 'read_only_api', message: 'DHEvals API is read-only.' })
    return
  }
  if (url.pathname === '/healthz') {
    writeJson(response, 200, {
      status: 'ok',
      service: 'dhevals-api',
      schema_version: '0.1.0',
      generated_at: new Date().toISOString(),
      data_root: 'public/data',
    })
    return
  }
  const fileName = routes.get(url.pathname)
  if (!fileName) {
    writeJson(response, 404, { error: 'not_found', path: url.pathname })
    return
  }
  const filePath = resolve(dataRoot, fileName)
  if (!filePath.startsWith(`${dataRoot}/`) || !existsSync(filePath)) {
    writeJson(response, 404, { error: 'artifact_not_available', path: url.pathname })
    return
  }
  try {
    const payload = JSON.parse(readFileSync(filePath, 'utf8'))
    writeJson(response, 200, payload)
  } catch (error) {
    writeJson(response, 500, { error: 'invalid_artifact', message: error.message })
  }
})

server.listen(port, host, () => {
  console.log(JSON.stringify({ service: 'dhevals-api', host, port, read_only: true }))
})

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', process.env.DHEVALS_API_ALLOW_ORIGIN || '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Cache-Control', 'no-store')
}

function writeJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
  if (response.req?.method === 'HEAD') response.end()
  else response.end(`${body}\n`)
}

function close() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', close)
process.on('SIGTERM', close)
