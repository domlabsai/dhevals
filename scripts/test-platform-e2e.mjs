import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const commands = [
  'test:benchmarks',
  'test:cli-adapter',
  'test:model-cli',
  'validate:test-matrix',
  'test:matrix',
  'test:independent',
  'test:judge-runner',
  'build:comparison-execution',
  'test:sacilm-preflight',
  'test:sacilm-e2e',
  'test:sacilm-wrapper',
  'test:sacilm-promotion',
  'test:sacilm-promotion-ready',
  'test:comparison-wrapper',
  'test:comparison-promotion',
  'test:manifest-finalizer',
  'test:calibration-import',
  'build:calibration-handoff',
  'test:calibration-ready',
  'test:calibration-handoff',
  'test:api',
  'build',
  'test:public-docs',
  'test:public-projection',
  'test:production-bundle',
  'test:e2e',
  'test:goal-audit',
]

for (const script of commands) {
  console.log(`\n=== npm run ${script} ===`)
  const result = spawnSync('npm', ['run', script], { cwd: root, encoding: 'utf8', stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`Platform E2E stopped at npm run ${script}`)
    process.exit(result.status ?? 1)
  }
}

console.log('\n=== restoring offline public baseline ===')
const restore = spawnSync('npm', ['run', 'run:calibration'], { cwd: root, encoding: 'utf8', stdio: 'inherit' })
if (restore.status !== 0) process.exit(restore.status ?? 1)
console.log('\n=== npm run audit:goal ===')
const audit = spawnSync('npm', ['run', 'audit:goal'], { cwd: root, encoding: 'utf8', stdio: 'inherit' })
if (audit.status !== 0) process.exit(audit.status ?? 1)
console.log(JSON.stringify({ status: 'passed', commands: commands.length + 1, baseline: 'restored', goal_audit: 'written' }, null, 2))
