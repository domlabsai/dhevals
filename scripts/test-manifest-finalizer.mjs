import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveSacilmManifestPath } from './sacilm-manifest-path.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = resolve(root, 'benchmarks/models/sacilm/v0.1/model.json')
const before = readFileSync(source, 'utf8')
const directory = mkdtempSync(resolve(tmpdir(), 'dhevals-manifest-finalizer-'))
const output = resolve(directory, 'model-ready.json')
const catalogOutput = resolve(directory, 'model-catalog.json')
const readyPath = resolve(root, 'benchmarks/models/sacilm/v0.1/model-ready.json')
const readyBefore = existsSync(readyPath) ? readFileSync(readyPath, 'utf8') : null
const autoManifestRoot = resolve(directory, 'auto-root')
const autoManifestDirectory = resolve(autoManifestRoot, 'benchmarks/models/sacilm/v0.1')
mkdirSync(autoManifestDirectory, { recursive: true })
writeFileSync(resolve(autoManifestDirectory, 'model-ready.json'), '{}\n', 'utf8')
const env = {
  ...process.env,
  DHEVALS_SACILM_MANIFEST_OUTPUT: output,
  DHEVALS_SACILM_BASE_MODEL_ID: 'local-test-base',
  DHEVALS_SACILM_BASE_MODEL_LICENSE: 'apache-2.0',
  DHEVALS_SACILM_CHECKPOINT: 'local-test-checkpoint',
  DHEVALS_SACILM_CHECKPOINT_REVISION: 'git:local-checkpoint',
  DHEVALS_SACILM_CHECKPOINT_SHA256: 'a'.repeat(64),
  DHEVALS_SACILM_DATASET_SHA256: 'b'.repeat(64),
  DHEVALS_SACILM_DATASET_LICENSE: 'internal-reviewed',
  DHEVALS_SACILM_QUANTIZATION: '4bit-nf4',
  DHEVALS_SACILM_LORA: 'r=16-alpha=32',
  DHEVALS_SACILM_SEQUENCE_LENGTH: '4096',
  DHEVALS_SACILM_PACKING: 'true',
  DHEVALS_SACILM_HARDWARE: 'A100-80GB',
  DHEVALS_SACILM_RUNTIME_IMAGE: 'local/test-image@sha256:' + 'c'.repeat(64),
  DHEVALS_SACILM_TRAINING_COMMIT: 'git:local-training',
}

try {
  const command = spawnSync(process.execPath, ['scripts/finalize-sacilm-manifest.mjs'], { cwd: root, env, encoding: 'utf8', stdio: 'pipe' })
  if (command.status !== 0) throw new Error(`finalizer exited ${command.status}: ${command.stderr || command.stdout}`)
  const manifest = JSON.parse(readFileSync(output, 'utf8'))
  if (manifest.status !== 'ready') throw new Error(`expected ready manifest, got ${manifest.status}`)
  if (manifest.checkpoint.sha256 !== 'a'.repeat(64) || manifest.post_training.dataset.sha256 !== 'b'.repeat(64)) throw new Error('finalizer did not preserve the supplied hashes')
  if (readFileSync(source, 'utf8') !== before) throw new Error('finalizer mutated the draft source manifest')
  const autoSelected = resolveSacilmManifestPath(autoManifestRoot)
  if (autoSelected !== 'benchmarks/models/sacilm/v0.1/model-ready.json') throw new Error(`automatic manifest selection did not prefer finalized output: ${autoSelected}`)
  const explicitSelected = resolveSacilmManifestPath(autoManifestRoot, 'benchmarks/models/sacilm/v0.1/model.json')
  if (explicitSelected !== 'benchmarks/models/sacilm/v0.1/model.json') throw new Error('explicit manifest path was not preserved')
  // The derived registry must follow the same auto-selection rule once a
  // finalized manifest appears, without requiring a registry edit.
  writeFileSync(readyPath, '{}\n', 'utf8')
  const catalogCommand = spawnSync(process.execPath, ['scripts/build-model-catalog.mjs'], {
    cwd: root,
    env: { ...process.env, DHEVALS_MODEL_CATALOG_OUTPUT: catalogOutput },
    encoding: 'utf8',
    stdio: 'pipe',
  })
  if (catalogCommand.status !== 0) throw new Error(`model catalog exited ${catalogCommand.status}: ${catalogCommand.stderr || catalogCommand.stdout}`)
  const catalog = JSON.parse(readFileSync(catalogOutput, 'utf8'))
  if (catalog.models.find((entry) => entry.id === 'sacilm')?.manifest !== 'benchmarks/models/sacilm/v0.1/model-ready.json') throw new Error('model catalog did not select finalized SaciLM manifest')
  console.log(JSON.stringify({ status: 'ready', output, source_unchanged: true, auto_manifest: autoSelected, explicit_manifest: explicitSelected, catalog_manifest: 'benchmarks/models/sacilm/v0.1/model-ready.json', checkpoint_hash: manifest.checkpoint.sha256, dataset_hash: manifest.post_training.dataset.sha256 }, null, 2))
} finally {
  if (readyBefore === null) rmSync(readyPath, { force: true })
  else writeFileSync(readyPath, readyBefore, 'utf8')
  rmSync(directory, { recursive: true, force: true })
}
