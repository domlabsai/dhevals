import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const directory = mkdtempSync(resolve(tmpdir(), 'dhevals-sacilm-preflight-'))
const output = resolve(directory, 'preflight.json')
const publicOutput = resolve(directory, 'public-preflight.json')
let server

try {
  server = createServer((request, response) => {
    if (request.method !== 'POST' || !request.url?.endsWith('/chat/completions')) {
      response.writeHead(404)
      response.end()
      return
    }
    const body = JSON.stringify({
      model: 'sacilm',
      choices: [{ message: { content: 'DHEvals' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    })
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
    response.end(body)
  })
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer))
  const address = server.address()
  const child = spawn(process.execPath, ['scripts/preflight-sacilm.mjs'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DHEVALS_SACILM_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
      DHEVALS_SACILM_PREFLIGHT_OUTPUT: output,
      DHEVALS_SACILM_PREFLIGHT_PUBLIC_OUTPUT: publicOutput,
    },
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  const status = await new Promise((resolveChild) => child.on('close', (code) => resolveChild(code ?? 1)))
  if (status !== 0) throw new Error(`preflight exited ${status}: ${stderr || stdout}`)
  const result = JSON.parse(readFileSync(output, 'utf8'))
  if (result.status !== 'ready') throw new Error(`expected ready preflight, got ${result.status}`)
  if (result.model_manifest?.id !== 'sacilm' || result.model_manifest?.version !== '0.1.0') throw new Error('preflight did not record the model manifest identity')
  if (!result.checks?.every((check) => check.passed)) throw new Error('preflight contains a failed contract check')
  console.log(JSON.stringify({ status: 'ready', preflight: output, model_manifest: result.model_manifest, checks: result.checks.length }, null, 2))
} finally {
  server?.closeAllConnections?.()
  if (server) await new Promise((resolveClose) => server.close(resolveClose))
  rmSync(directory, { recursive: true, force: true })
}
