import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const SACILM_DRAFT_MANIFEST = 'benchmarks/models/sacilm/v0.1/model.json'
export const SACILM_READY_MANIFEST = 'benchmarks/models/sacilm/v0.1/model-ready.json'

/**
 * An explicit environment value always wins. Without one, automatically use
 * the finalized manifest when it exists so the first real-run checklist does
 * not silently keep reading the draft template.
 */
export function resolveSacilmManifestPath(root, configuredPath = '') {
  const configured = String(configuredPath || '').trim()
  if (configured) return configured
  return existsSync(resolve(root, SACILM_READY_MANIFEST)) ? SACILM_READY_MANIFEST : SACILM_DRAFT_MANIFEST
}
