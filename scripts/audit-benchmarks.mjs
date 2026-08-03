import { copyFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const suitePath = process.env.DHEVALS_AUDIT_SUITE || 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json'
const fixturePath = process.env.DHEVALS_AUDIT_FIXTURE || 'benchmarks/suites/heavy-user-ptbr/v0.2/fixtures/sacilm-calibration-fixture.json'
const negativeFixturePath = process.env.DHEVALS_AUDIT_NEGATIVE_FIXTURE || 'benchmarks/suites/heavy-user-ptbr/v0.2/fixtures/negative-fixture.json'
const rubricPath = process.env.DHEVALS_AUDIT_RUBRIC || 'benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-rubric.json'
const examplesPath = process.env.DHEVALS_AUDIT_EXAMPLES || 'benchmarks/calibration/heavy-user-ptbr/v0.2/anchor-examples.json'
const registryPath = process.env.DHEVALS_AUDIT_REGISTRY || 'benchmarks/comparisons/v0.2/models.json'
const outputPath = resolve(root, process.env.DHEVALS_AUDIT_OUTPUT || 'reports/audits/heavy-user-ptbr-v0.2.json')
const publicOutputPath = resolve(root, process.env.DHEVALS_AUDIT_PUBLIC_OUTPUT || 'public/data/latest-audit.json')

const args = [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-audit',
  '--suite', suitePath,
  '--fixture', fixturePath,
  '--negative-fixture', negativeFixturePath,
  '--rubric', rubricPath,
  '--examples', examplesPath,
  '--comparison-registry', registryPath,
  '--output', outputPath,
]
const command = spawnSync('uv', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(command.stdout || '')
process.stderr.write(command.stderr || '')
if (command.status !== 0) process.exit(command.status ?? 1)
copyFileSync(outputPath, publicOutputPath)
console.log(`Updated ${outputPath}`)
console.log(`Published ${publicOutputPath}`)
