import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const runPath = resolve(root, 'reports/fixtures/sacilm-heavy-user-expanded-v0.3.json')
const reportPath = resolve(root, 'reports/fixtures/sacilm-heavy-user-expanded-v0.3.report.json')
const rubricPath = resolve(root, 'benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-rubric.json')
const runBefore = readFileSync(runPath, 'utf8')
const directory = mkdtempSync(resolve(tmpdir(), 'dhevals-judge-runner-'))
const output = resolve(directory, 'judge.json')
const scorecardOutput = resolve(directory, 'scorecard.json')
let requests = 0
let server

function runCommand(args) {
  return new Promise((resolveCommand) => {
    const child = spawn('uv', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('close', (code, signal) => resolveCommand({ status: code ?? 1, signal, stdout, stderr }))
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
        const userMessage = payload.messages?.find((message) => message.role === 'user')?.content
        const judgeInput = JSON.parse(userMessage)
        const dimensions = judgeInput.rubric?.map((dimension) => dimension.id) ?? []
        if (!judgeInput.task_id || !dimensions.length) throw new Error('judge input is missing task/dimensions')
        requests += 1
        const body = JSON.stringify({
          model: payload.model,
          choices: [{
            message: {
              content: JSON.stringify({
                evaluations: dimensions.map((dimension_id) => ({ dimension_id, score: 4, evidence: 'evidência observável no output da fixture' })),
              }),
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
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
  const command = await runCommand([
    'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-judge-run',
    '--run', runPath,
    '--rubric', rubricPath,
    '--base-url', `http://127.0.0.1:${address.port}/v1`,
    '--model-id', 'judge-local-fixture',
    '--output', output,
  ])
  process.stdout.write(command.stdout || '')
  process.stderr.write(command.stderr || '')
  if (command.status !== 0) throw new Error(`judge runner exited ${command.status}`)
  const artifact = JSON.parse(readFileSync(output, 'utf8'))
  if (artifact.status !== 'evaluated' || artifact.score !== 1) throw new Error(`unexpected judge artifact: ${JSON.stringify(artifact)}`)
  if (artifact.evaluations.length !== 60) throw new Error(`expected 60 dimension evaluations, got ${artifact.evaluations.length}`)
  if (requests !== 20) throw new Error(`expected one judge request per v0.3 task, got ${requests}`)
  if (readFileSync(runPath, 'utf8') !== runBefore) throw new Error('judge runner mutated the source run')
  if (JSON.stringify(artifact).includes('Bearer')) throw new Error('judge artifact contains an authorization header')
  const scorecardCommand = await runCommand([
    'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-scorecard',
    '--report', reportPath,
    '--judge', output,
    '--output', scorecardOutput,
  ])
  process.stdout.write(scorecardCommand.stdout || '')
  process.stderr.write(scorecardCommand.stderr || '')
  if (scorecardCommand.status !== 0) throw new Error(`scorecard judge integration exited ${scorecardCommand.status}`)
  const scorecard = JSON.parse(readFileSync(scorecardOutput, 'utf8'))
  if (scorecard.dimensions?.judge_quality?.status !== 'evaluated' || scorecard.dimensions.judge_quality.score !== 1) throw new Error('scorecard did not consume the evaluated judge artifact')
  console.log(JSON.stringify({ status: 'passed', requests, evaluations: artifact.evaluations.length, score: artifact.score, independent_from_quality: artifact.metadata.independent_from_quality, scorecard_judge_quality: scorecard.dimensions.judge_quality.score }, null, 2))
} finally {
  server?.closeAllConnections?.()
  if (server) await new Promise((resolveClose) => server.close(resolveClose))
  rmSync(directory, { recursive: true, force: true })
}
