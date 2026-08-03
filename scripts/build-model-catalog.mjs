import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SACILM_DRAFT_MANIFEST, resolveSacilmManifestPath } from './sacilm-manifest-path.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const output = resolve(root, process.env.DHEVALS_MODEL_CATALOG_OUTPUT || 'public/data/model-catalog.json')
const registryPaths = [
  'benchmarks/comparisons/v0.2/models.json',
  'benchmarks/comparisons/v0.3/models.json',
]
const byModel = new Map()
for (const registryPath of registryPaths) {
  const absolute = resolve(root, registryPath)
  if (!existsSync(absolute)) continue
  const registry = JSON.parse(readFileSync(absolute, 'utf8'))
  for (const model of registry.models || []) {
    if (!model?.id) continue
    const adapter = model.adapter || (model.cli_command_env ? 'command-line' : 'openai-compatible')
    const configurationEnv = adapter === 'command-line' || adapter === 'cli' ? model.cli_command_env : model.base_url_env
    const manifestPath = model.id === 'sacilm'
      ? resolveSacilmManifestPath(root, model.model_manifest === SACILM_DRAFT_MANIFEST ? '' : model.model_manifest)
      : (model.model_manifest || null)
    const existing = byModel.get(model.id) || {
      id: model.id,
      label: model.label || model.id,
      provider: model.provider || 'unknown',
      publication: model.publication || 'unknown',
      status: model.status || 'configured',
      suite_versions: [],
      adapter: adapter === 'cli' ? 'command-line' : adapter,
      endpoint_env: model.base_url_env || null,
      command_env: model.cli_command_env || null,
      manifest: manifestPath,
      configured: Boolean(configurationEnv && process.env[configurationEnv]),
    }
    existing.suite_versions = [...new Set([...existing.suite_versions, registry.suite_version])].sort()
    existing.configured = existing.configured || Boolean(configurationEnv && process.env[configurationEnv])
    if (model.id === 'sacilm') existing.manifest = manifestPath
    if (model.status) existing.status = model.status
    byModel.set(model.id, existing)
  }
}
const catalog = {
  kind: 'dhevals_model_catalog',
  schema_version: '0.1.0',
  generated_at: new Date().toISOString(),
  registries: registryPaths.filter((path) => existsSync(resolve(root, path))).map((path) => relative(root, resolve(root, path))),
  models: [...byModel.values()].sort((left, right) => left.id.localeCompare(right.id)),
}
mkdirSync(resolve(output, '..'), { recursive: true })
writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output, models: catalog.models.length, ids: catalog.models.map((model) => model.id) }, null, 2))
