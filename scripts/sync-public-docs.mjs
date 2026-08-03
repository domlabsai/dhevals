import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceDirectory = resolve(root, 'docs')
const publicDirectory = resolve(root, 'public/docs')

mkdirSync(publicDirectory, { recursive: true })
const copied = readdirSync(sourceDirectory)
  .filter((file) => /^dhevals-.*\.md$/i.test(file))
  .sort()

for (const file of copied) copyFileSync(resolve(sourceDirectory, file), resolve(publicDirectory, basename(file)))

console.log(JSON.stringify({ status: 'ready', output: 'public/docs', documents: copied.length }, null, 2))
