import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const templatePath = resolve(root, process.env.DHEVALS_SACILM_MANIFEST_TEMPLATE || 'benchmarks/models/sacilm/v0.1/model.json')
const outputPath = resolve(root, process.env.DHEVALS_SACILM_MANIFEST_OUTPUT || 'benchmarks/models/sacilm/v0.1/model-ready.json')
const manifest = readJson(templatePath)
const required = {
  baseModelId: 'DHEVALS_SACILM_BASE_MODEL_ID',
  baseModelLicense: 'DHEVALS_SACILM_BASE_MODEL_LICENSE',
  checkpointId: 'DHEVALS_SACILM_CHECKPOINT',
  checkpointRevision: 'DHEVALS_SACILM_CHECKPOINT_REVISION',
  checkpointSha256: 'DHEVALS_SACILM_CHECKPOINT_SHA256',
  datasetSha256: 'DHEVALS_SACILM_DATASET_SHA256',
  datasetLicense: 'DHEVALS_SACILM_DATASET_LICENSE',
  quantization: 'DHEVALS_SACILM_QUANTIZATION',
  lora: 'DHEVALS_SACILM_LORA',
  sequenceLength: 'DHEVALS_SACILM_SEQUENCE_LENGTH',
  packing: 'DHEVALS_SACILM_PACKING',
  hardware: 'DHEVALS_SACILM_HARDWARE',
  runtimeImage: 'DHEVALS_SACILM_RUNTIME_IMAGE',
  trainingCommit: 'DHEVALS_SACILM_TRAINING_COMMIT',
}
const values = Object.fromEntries(Object.entries(required).map(([key, envKey]) => [key, process.env[envKey]?.trim() || '']))
const missing = Object.entries(required).filter(([key]) => !values[key]).map(([, envKey]) => envKey)
if (missing.length) {
  console.error(`Missing manifest finalization variables: ${missing.join(', ')}`)
  process.exit(2)
}

if (!/^[0-9a-f]{64}$/.test(values.checkpointSha256)) {
  console.error('DHEVALS_SACILM_CHECKPOINT_SHA256 must be a lowercase SHA-256 hash')
  process.exit(2)
}
if (!/^[0-9a-f]{64}$/.test(values.datasetSha256)) {
  console.error('DHEVALS_SACILM_DATASET_SHA256 must be a lowercase SHA-256 hash')
  process.exit(2)
}

const sequenceLength = Number(values.sequenceLength)
if (!Number.isInteger(sequenceLength) || sequenceLength <= 0) {
  console.error('DHEVALS_SACILM_SEQUENCE_LENGTH must be a positive integer')
  process.exit(2)
}
if (!['true', 'false'].includes(values.packing.toLowerCase())) {
  console.error('DHEVALS_SACILM_PACKING must be true or false')
  process.exit(2)
}

manifest.status = 'ready'
manifest.base_model = {
  ...manifest.base_model,
  id: values.baseModelId,
  license: values.baseModelLicense,
  ...(process.env.DHEVALS_SACILM_BASE_MODEL_REVISION ? { revision: process.env.DHEVALS_SACILM_BASE_MODEL_REVISION.trim() } : {}),
}
manifest.checkpoint = {
  ...manifest.checkpoint,
  id: values.checkpointId,
  revision: values.checkpointRevision,
  sha256: values.checkpointSha256,
}
manifest.post_training = {
  ...manifest.post_training,
  quantization: values.quantization,
  training_commit: values.trainingCommit,
  config: {
    ...manifest.post_training?.config,
    lora: values.lora,
    sequence_length: sequenceLength,
    packing: values.packing.toLowerCase() === 'true',
  },
  dataset: {
    ...manifest.post_training?.dataset,
    sha256: values.datasetSha256,
    license: values.datasetLicense,
    ...(process.env.DHEVALS_SACILM_DATASET_ID ? { id: process.env.DHEVALS_SACILM_DATASET_ID.trim() } : {}),
    ...(process.env.DHEVALS_SACILM_DATASET_VERSION ? { version: process.env.DHEVALS_SACILM_DATASET_VERSION.trim() } : {}),
  },
}
manifest.training_runtime = {
  ...manifest.training_runtime,
  hardware: values.hardware,
  image: values.runtimeImage,
}
manifest.provenance = {
  ...manifest.provenance,
  publication: process.env.DHEVALS_SACILM_PUBLICATION || 'internal-reviewed',
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
const validation = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core',
  'dhevals-model', 'validate', '--require-ready', '--manifest', outputPath,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(validation.stdout || '')
process.stderr.write(validation.stderr || '')
if (validation.status !== 0) process.exit(validation.status ?? 2)

const hash = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core',
  'dhevals-model', 'hash', '--require-ready', '--manifest', outputPath,
], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(hash.stdout || '')
process.stderr.write(hash.stderr || '')
if (hash.status !== 0) process.exit(hash.status ?? 2)
console.log(JSON.stringify({ output: outputPath, status: manifest.status, content_hash: hash.stdout.trim().split(/\s+/).at(-1) }, null, 2))

function readJson(path) {
  if (!existsSync(path)) {
    console.error(`Manifest template not found: ${path}`)
    process.exit(2)
  }
  try {
    const payload = JSON.parse(readFileSync(path, 'utf8'))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('expected an object')
    return payload
  } catch (error) {
    console.error(`Unable to read manifest template: ${error.message}`)
    process.exit(2)
  }
}
