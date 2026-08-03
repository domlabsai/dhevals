process.env.DHEVALS_SUITE_PATH = 'benchmarks/suites/heavy-user-ptbr/v0.2/suite.json'
process.env.DHEVALS_FIXTURE_PATH = 'benchmarks/suites/heavy-user-ptbr/v0.2/fixtures/negative-fixture.json'
process.env.DHEVALS_REPORT_OUTPUT = 'reports/fixtures/sacilm-heavy-user-negative-v0.2.json'
process.env.DHEVALS_MODEL_ID = 'negative-fixture'
process.env.DHEVALS_CHECKPOINT = 'negative-fixture'
process.env.DHEVALS_RUNTIME = 'offline-fixture'
process.env.DHEVALS_TRAINING_COMMIT = 'negative-fixture'

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const audit = spawnSync(process.execPath, ['scripts/audit-benchmarks.mjs'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
process.stdout.write(audit.stdout || '')
process.stderr.write(audit.stderr || '')
if (audit.status !== 0) process.exit(audit.status ?? 1)

await import('./run-fixture.mjs')
