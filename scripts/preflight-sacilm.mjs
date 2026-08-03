import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveSacilmManifestPath } from './sacilm-manifest-path.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const baseUrl = process.env.DHEVALS_SACILM_BASE_URL
const apiKeyEnv = process.env.DHEVALS_SACILM_API_KEY_ENV || 'DHEVALS_SACILM_API_KEY'
const modelId = process.env.DHEVALS_SACILM_MODEL_ID || 'sacilm'
const provider = process.env.DHEVALS_SACILM_PROVIDER || 'runpod-openai-compatible'
const modelManifestPath = resolveSacilmManifestPath(root, process.env.DHEVALS_SACILM_MODEL_MANIFEST)
const modelManifestAbsolutePath = resolve(root, modelManifestPath)
const timeoutMs = Number(process.env.DHEVALS_SACILM_PREFLIGHT_TIMEOUT_MS || 30_000)
const outputPath = resolve(root, process.env.DHEVALS_SACILM_PREFLIGHT_OUTPUT || 'reports/preflight/sacilm-latest.json')
const publicOutputPath = resolve(root, process.env.DHEVALS_SACILM_PREFLIGHT_PUBLIC_OUTPUT || 'public/data/latest-preflight.json')
const generation = {
  temperature: Number(process.env.DHEVALS_SACILM_TEMPERATURE || 0.2),
  max_tokens: Number(process.env.DHEVALS_SACILM_PREFLIGHT_MAX_TOKENS || 32),
  seed: Number(process.env.DHEVALS_SACILM_SEED || 7),
}

if (!baseUrl) {
  console.error('Missing DHEVALS_SACILM_BASE_URL (expected an OpenAI-compatible /v1 endpoint).')
  process.exit(2)
}

const endpoint = baseUrl.replace(/\/+$/, '').endsWith('/chat/completions')
  ? baseUrl.replace(/\/+$/, '')
  : `${baseUrl.replace(/\/+$/, '')}/chat/completions`
const startedAt = new Date().toISOString()
const started = Date.now()
const checks = []
const warnings = []
let modelManifest = null
try {
  if (existsSync(modelManifestAbsolutePath)) {
    const parsedManifest = JSON.parse(readFileSync(modelManifestAbsolutePath, 'utf8'))
    if (parsedManifest && typeof parsedManifest === 'object' && !Array.isArray(parsedManifest)) {
      modelManifest = {
        id: typeof parsedManifest.id === 'string' ? parsedManifest.id : null,
        version: typeof parsedManifest.version === 'string' ? parsedManifest.version : null,
        status: typeof parsedManifest.status === 'string' ? parsedManifest.status : null,
      }
    }
  }
} catch {
  warnings.push('model manifest could not be parsed; run:sacilm will reject it before execution')
}
if (!modelManifest) warnings.push(`model manifest not found at ${modelManifestPath}`)
let payload = null
let error = null

try {
  const headers = { 'content-type': 'application/json' }
  const apiKey = process.env[apiKeyEnv]
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Responda apenas com a palavra DHEvals.' }],
        temperature: generation.temperature,
        max_tokens: generation.max_tokens,
        seed: generation.seed,
      }),
    })
    checks.push({ id: 'http-status', passed: response.ok, details: `HTTP ${response.status}` })
    const responseText = await response.text()
    try {
      payload = JSON.parse(responseText)
      checks.push({ id: 'json-response', passed: true, details: 'JSON válido' })
    } catch {
      checks.push({ id: 'json-response', passed: false, details: 'resposta não é JSON válido' })
      error = `provider returned invalid JSON: ${responseText.slice(0, 240)}`
    }
    if (!response.ok && !error) error = `provider returned HTTP ${response.status}`
  } finally {
    clearTimeout(timer)
  }
} catch (caught) {
  error = caught?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : `${caught?.name || 'Error'}: ${caught?.message || caught}`
  checks.push({ id: 'http-request', passed: false, details: error })
}

const choice = payload?.choices?.[0]
const content = choice?.message?.content
const contentPassed = typeof content === 'string' && content.trim().length > 0
checks.push({ id: 'message-content', passed: contentPassed, details: contentPassed ? `string com ${content.length} caracteres` : 'choices[0].message.content ausente ou vazio' })
if (payload && typeof payload.model === 'string' && payload.model !== modelId) {
  warnings.push(`provider returned model ${payload.model} instead of requested ${modelId}`)
}
const usage = payload?.usage
if (!usage || typeof usage !== 'object') warnings.push('provider não retornou usage.prompt_tokens/completion_tokens')

const passed = checks.every((check) => check.passed)
const result = {
  schema_version: '0.1.0',
  kind: 'dhevals_sacilm_preflight',
  status: passed ? 'ready' : 'failed',
  generated_at: new Date().toISOString(),
  started_at: startedAt,
  latency_ms: Date.now() - started,
  endpoint: _safeEndpoint(endpoint),
  model: { model_id: modelId, provider },
  model_manifest: modelManifest ? { ...modelManifest, path: modelManifestPath } : null,
  generation,
  provenance: {
    checkpoint: process.env.DHEVALS_SACILM_CHECKPOINT || null,
    runtime: process.env.DHEVALS_SACILM_RUNTIME || null,
    training_commit: process.env.DHEVALS_SACILM_TRAINING_COMMIT || null,
  },
  response: {
    model: typeof payload?.model === 'string' ? payload.model : null,
    finish_reason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
    content_length: typeof content === 'string' ? content.length : 0,
    usage: _usageSummary(usage),
  },
  checks,
  warnings,
  error,
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8')
mkdirSync(dirname(publicOutputPath), { recursive: true })
writeFileSync(publicOutputPath, JSON.stringify(result, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ output: outputPath, public_output: publicOutputPath, status: result.status, latency_ms: result.latency_ms, checks: checks.length, warnings: warnings.length }, null, 2))
process.exit(passed ? 0 : 2)

function _safeEndpoint(value) {
  try {
    const parsed = new URL(value)
    parsed.username = ''
    parsed.password = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return value.replace(/([?&](?:api[_-]?key|token)=)[^&]+/gi, '$1[redacted]')
  }
}

function _usageSummary(value) {
  if (!value || typeof value !== 'object') return null
  const summary = {}
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    if (typeof value[key] === 'number') summary[key] = value[key]
  }
  return Object.keys(summary).length ? summary : null
}
