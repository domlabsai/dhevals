import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceDirectory = resolve(root, 'docs')
const publicDirectory = resolve(root, 'public/docs')
const candidates = readdirSync(sourceDirectory).filter((file) => /^dhevals-.*\.md$/i.test(file)).sort()
const documents = candidates.filter((file) => !/sacilm/i.test(readFileSync(resolve(sourceDirectory, file), 'utf8')))
const errors = []

for (const file of documents) {
  const sourcePath = resolve(sourceDirectory, file)
  const publicPath = resolve(publicDirectory, file)
  if (!existsSync(publicPath)) {
    errors.push(`${file}: public copy is missing`)
    continue
  }
  const source = readFileSync(sourcePath)
  const published = readFileSync(publicPath)
  if (!source.equals(published)) errors.push(`${file}: public copy differs from source`)
  if (!source.toString('utf8').trimStart().startsWith('# ')) errors.push(`${file}: source is missing a Markdown heading`)
  if (/sacilm/i.test(published.toString('utf8'))) errors.push(`${file}: deferred model reference leaked into public copy`)
}

if (errors.length) {
  console.error(JSON.stringify({ status: 'failed', documents: documents.length, errors }, null, 2))
  process.exit(2)
}

console.log(JSON.stringify({ status: 'passed', documents: documents.length, omitted_deferred: candidates.length - documents.length, directory: 'public/docs' }, null, 2))
