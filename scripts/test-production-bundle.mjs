import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dist = resolve(root, 'dist')
const required = [
  'index.html',
  'data/latest-run.json',
  'data/latest-judge.json',
  'data/latest-goal-audit.json',
  'data/latest-sacilm-readiness.json',
  'data/calibration/v0.3/handoff.json',
  'docs/dhevals-sacilm-run-checklist.md',
  'docs/dhevals-sacilm-runtime-contract.md',
]
const missing = required.filter((file) => !existsSync(resolve(dist, file)))
const sourceDocs = readdirSync(resolve(root, 'docs')).filter((file) => /^dhevals-.*\.md$/i.test(file)).sort()
const bundledDocs = readdirSync(resolve(dist, 'docs')).filter((file) => /^dhevals-.*\.md$/i.test(file)).sort()
const errors = [...missing.map((file) => `${file}: missing from dist`)]
if (sourceDocs.join('\n') !== bundledDocs.join('\n')) errors.push(`docs: expected ${sourceDocs.length} files, found ${bundledDocs.length}`)
for (const file of sourceDocs) {
  const source = readFileSync(resolve(root, 'docs', file))
  const bundled = existsSync(resolve(dist, 'docs', file)) ? readFileSync(resolve(dist, 'docs', file)) : null
  if (!bundled || !source.equals(bundled)) errors.push(`${file}: bundled copy differs from source`)
}
if (existsSync(resolve(dist, 'index.html')) && !readFileSync(resolve(dist, 'index.html'), 'utf8').includes('<title>DHEvals')) errors.push('index.html: title is missing')

if (errors.length) {
  console.error(JSON.stringify({ status: 'failed', errors }, null, 2))
  process.exit(2)
}

console.log(JSON.stringify({ status: 'passed', dist: 'dist', required_artifacts: required.length, documents: bundledDocs.length }, null, 2))
