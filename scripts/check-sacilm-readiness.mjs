import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveSacilmManifestPath } from './sacilm-manifest-path.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const manifestRelativePath = resolveSacilmManifestPath(root, process.env.DHEVALS_SACILM_MODEL_MANIFEST)
const manifestPath = resolve(root, manifestRelativePath)
const output = resolve(root, process.env.DHEVALS_SACILM_READINESS_OUTPUT || 'reports/readiness/sacilm-latest.json')
const publicOutput = resolve(root, process.env.DHEVALS_SACILM_READINESS_PUBLIC_OUTPUT || 'public/data/latest-sacilm-readiness.json')
const checks = []
const evaluationMode = String(process.env.DHEVALS_SACILM_EVALUATION_MODE || 'standby').toLowerCase()

if (['standby', 'deferred', 'paused'].includes(evaluationMode)) {
  const artifact = {
    kind: 'dhevals_sacilm_readiness',
    schema_version: '0.1.0',
    status: 'deferred',
    generated_at: new Date().toISOString(),
    model: { id: 'sacilm', version: null, manifest: null },
    mode: 'standby',
    checks: [{ id: 'evaluation_lane', status: 'deferred', reason: 'SaciLM está em standby; a lane genérica do DHEvals pode avaliar outros modelos.' }],
    next_actions: ['quando o desenvolvimento começar, trocar DHEVALS_SACILM_EVALUATION_MODE para active, configurar DHEVALS_SACILM_BASE_URL e preparar manifesto/preflight'],
    safety: { secrets_recorded: false, endpoint_value_recorded: false },
  }
  mkdirSync(resolve(output, '..'), { recursive: true })
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  if (publicOutput !== output) {
    mkdirSync(resolve(publicOutput, '..'), { recursive: true })
    writeFileSync(publicOutput, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  }
  console.log(JSON.stringify({ output, public_output: publicOutput, status: artifact.status, mode: artifact.mode }, null, 2))
  if (process.argv.includes('--strict')) process.exit(2)
  process.exit(0)
}

const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null
if (!manifest) add('model_manifest', 'blocked', 'manifesto do SaciLM não foi encontrado')
else if (manifest.status !== 'ready') add('model_manifest', 'pending', `manifesto está em ${manifest.status}; finalize checkpoint, dataset e proveniência`)
else {
  const validation = spawnSync('uv', ['run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-model', 'validate', '--require-ready', '--manifest', manifestPath], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  if (validation.status === 0) add('model_manifest', 'ready', null)
  else add('model_manifest', 'blocked', 'manifesto marcado ready, mas falhou na validação estrita do núcleo')
}

const baseUrl = process.env.DHEVALS_SACILM_BASE_URL
if (!baseUrl) add('endpoint', 'blocked', 'DHEVALS_SACILM_BASE_URL não está definido')
else if (!safeUrl(baseUrl)) add('endpoint', 'blocked', 'DHEVALS_SACILM_BASE_URL não é uma URL segura')
else add('endpoint', 'ready', null)

const preflightPath = resolve(root, process.env.DHEVALS_SACILM_PREFLIGHT_OUTPUT || 'reports/preflight/sacilm-latest.json')
const preflight = existsSync(preflightPath) ? readJson(preflightPath) : null
if (!preflight) add('preflight', 'pending', 'execute npm run preflight:sacilm depois de configurar o endpoint')
else if (preflight.status !== 'ready') add('preflight', 'blocked', `preflight retornou ${preflight.status}`)
else add('preflight', 'ready', null)

const calibrationPaths = [
  ['calibration_v02', 'public/data/latest-calibration.json'],
  ['calibration_v03', 'public/data/calibration/v0.3/progress.json'],
]
for (const [id, relativePath] of calibrationPaths) {
  const path = resolve(root, relativePath)
  const calibration = existsSync(path) ? readJson(path) : null
  if (!calibration) add(id, 'pending', 'artefato de calibração ainda não foi gerado')
  else if (calibration.status !== 'ready' || calibration.ready !== true) add(id, 'pending', `calibração está em ${calibration.status || 'unknown'} (${calibration.completed_groups || 0}/${calibration.required_groups || 0})`)
  else add(id, 'ready', null)
}

const datasetCatalogPath = resolve(root, 'public/data/dataset-catalog.json')
const datasetCatalog = existsSync(datasetCatalogPath) ? readJson(datasetCatalogPath) : null
if (!datasetCatalog || datasetCatalog.status !== 'ready') add('dataset_registry', 'blocked', 'dataset registry não está pronto')
else add('dataset_registry', 'ready', null)

const matrixExecutionPath = resolve(root, 'public/data/test-execution-latest.json')
const matrixExecution = existsSync(matrixExecutionPath) ? readJson(matrixExecutionPath) : null
if (!matrixExecution || matrixExecution.status !== 'ready') add('matrix_execution', 'blocked', 'execute npm run test:matrix')
else add('matrix_execution', 'ready', null)

const blocked = checks.filter((check) => check.status === 'blocked')
const pending = checks.filter((check) => check.status === 'pending')
const artifact = {
  kind: 'dhevals_sacilm_readiness',
  schema_version: '0.1.0',
  status: blocked.length ? 'blocked' : pending.length ? 'pending' : 'ready',
  generated_at: new Date().toISOString(),
  model: { id: manifest?.id || 'sacilm', version: manifest?.version || null, manifest: relativePath(manifestPath) },
  checks,
  next_actions: nextActions(),
  safety: { secrets_recorded: false, endpoint_value_recorded: false },
}
mkdirSync(resolve(output, '..'), { recursive: true })
writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
if (publicOutput !== output) {
  mkdirSync(resolve(publicOutput, '..'), { recursive: true })
  writeFileSync(publicOutput, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
}
console.log(JSON.stringify({ output, public_output: publicOutput, status: artifact.status, blocked: blocked.length, pending: pending.length }, null, 2))
if (process.argv.includes('--strict') && artifact.status !== 'ready') process.exit(2)

function add(id, status, reason) {
  checks.push({ id, status, reason })
}

function nextActions() {
  const actions = []
  if (checks.some((check) => check.id === 'endpoint' && check.status !== 'ready')) actions.push('configurar DHEVALS_SACILM_BASE_URL e executar npm run preflight:sacilm')
  if (checks.some((check) => check.id === 'model_manifest' && check.status !== 'ready')) actions.push('finalizar o manifesto sem placeholders com npm run finalize:sacilm-manifest')
  if (checks.some((check) => check.id.startsWith('calibration_') && check.status !== 'ready')) actions.push('importar duas revisões independentes e adjudicar desacordos')
  return actions
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function safeUrl(value) {
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

function relativePath(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path
}
