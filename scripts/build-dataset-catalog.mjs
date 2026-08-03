import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const output = resolve(root, process.env.DHEVALS_DATASET_CATALOG_OUTPUT || 'public/data/dataset-catalog.json')
const datasetRoot = resolve(root, process.env.DHEVALS_DATASET_ROOT || 'benchmarks/datasets')
const manifests = existsSync(datasetRoot)
  ? walk(datasetRoot).filter((path) => path.endsWith('dataset.json'))
  : []
const datasets = manifests.map((path) => {
  const payload = readJson(path)
  validateManifest(payload, path)
  return {
    id: payload.id,
    version: payload.version,
    status: payload.status,
    locale: payload.locale,
    purpose: payload.purpose,
    source_type: payload.source_type,
    license: payload.license,
    privacy: payload.privacy,
    source_artifacts: payload.source_artifacts,
    consumers: payload.consumers,
    provenance: payload.provenance,
    manifest: relative(root, path),
    content_hash: sha256Json(payload),
  }
})
const catalog = {
  kind: 'dhevals_dataset_catalog',
  schema_version: '0.1.0',
  status: datasets.length ? 'ready' : 'empty',
  generated_at: new Date().toISOString(),
  datasets: datasets.sort((left, right) => `${left.id}@${left.version}`.localeCompare(`${right.id}@${right.version}`)),
}
mkdirSync(resolve(output, '..'), { recursive: true })
writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output, status: catalog.status, datasets: datasets.length }, null, 2))

function walk(directory) {
  const paths = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) paths.push(...walk(path))
    else paths.push(path)
  }
  return paths
}

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected an object')
    return value
  } catch (error) {
    throw new Error(`invalid dataset manifest ${path}: ${error.message}`)
  }
}

function validateManifest(payload, path) {
  for (const key of ['schema_version', 'kind', 'id', 'version', 'status', 'locale', 'purpose', 'source_type', 'license']) {
    if (typeof payload[key] !== 'string' || !payload[key].trim()) throw new Error(`${path}: ${key} must be a non-empty string`)
  }
  if (payload.kind !== 'dhevals_dataset_manifest') throw new Error(`${path}: unsupported dataset manifest kind`)
  if (!['draft', 'ready', 'retired'].includes(payload.status)) throw new Error(`${path}: invalid dataset status`)
  if (!Array.isArray(payload.source_artifacts) || !payload.source_artifacts.length) throw new Error(`${path}: source_artifacts must not be empty`)
  if (!payload.privacy || payload.privacy.pii_allowed !== false) throw new Error(`${path}: privacy.pii_allowed must be false`)
  if (!payload.provenance || ['legal_entity', 'product', 'owner'].some((key) => typeof payload.provenance[key] !== 'string' || !payload.provenance[key].trim())) throw new Error(`${path}: provenance is incomplete`)
  if (JSON.stringify(payload).match(/(?:api[_-]?key|token|password|secret)/i)) throw new Error(`${path}: credential-looking field is not allowed`)
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(sortKeys(value)), 'utf8').digest('hex')
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
  return value
}
