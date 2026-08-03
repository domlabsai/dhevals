import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceDirectory = resolve(root, 'docs')
const publicDirectory = resolve(root, 'public/docs')

const candidates = readdirSync(sourceDirectory)
  .filter((file) => /^dhevals-.*\.md$/i.test(file))
  .sort()
const copied = candidates.filter((file) => !isDeferredDocument(file))

mkdirSync(publicDirectory, { recursive: true })
for (const file of readdirSync(publicDirectory)) {
  if (/^dhevals-.*\.md$/i.test(file) && !copied.includes(file)) {
    rmSync(resolve(publicDirectory, file), { force: true })
  }
}
for (const file of copied) copyFileSync(resolve(sourceDirectory, file), resolve(publicDirectory, basename(file)))

console.log(JSON.stringify({ status: 'ready', output: 'public/docs', documents: copied.length, omitted_deferred: candidates.length - copied.length }, null, 2))

function isDeferredDocument(file) {
  return /sacilm/i.test(readFileSync(resolve(sourceDirectory, file), 'utf8'))
}
