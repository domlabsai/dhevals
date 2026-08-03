import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const directory = mkdtempSync(join(tmpdir(), 'dhevals-goal-audit-'))
const report = join(directory, 'audit.json')
const publicOutput = join(directory, 'public-audit.json')
const result = spawnSync(process.execPath, ['scripts/audit-dhevals-goal.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    DHEVALS_GOAL_AUDIT_OUTPUT: report,
    DHEVALS_GOAL_AUDIT_PUBLIC_OUTPUT: publicOutput,
  },
})
if (result.status !== 0) {
  process.stderr.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  process.exit(result.status ?? 1)
}

const audit = JSON.parse(readFileSync(report, 'utf8'))
if (audit.kind !== 'dhevals_goal_audit') throw new Error('goal audit kind mismatch')
if (audit.local_status !== 'ready') throw new Error(`local E2E audit is not ready: ${audit.local_status}`)
if (audit.external_status === 'ready') throw new Error('external SaciLM gates unexpectedly claim readiness')
if (audit.checks.find((check) => check.id === 'calibration_pack_v03')?.status !== 'ready') throw new Error('v0.3 blind calibration pack is not ready')
if (audit.checks.find((check) => check.id === 'calibration_handoff')?.status !== 'ready') throw new Error('v0.3 calibration handoff is not ready')
if (audit.checks.find((check) => check.id === 'blueprint_components')?.status !== 'ready') throw new Error('Blueprint component traceability is not ready')
if (!audit.safety || audit.safety.secrets_recorded !== false || audit.safety.endpoint_value_recorded !== false) throw new Error('goal audit safety contract mismatch')
if (/(?:api[_-]?key|authorization|password|client[_-]?secret|access[_-]?token)\s*[:=]\s*[^\s,}]+/i.test(JSON.stringify(audit))) throw new Error('goal audit contains a credential-looking value')

console.log(JSON.stringify({
  status: 'passed',
  local_status: audit.local_status,
  external_status: audit.external_status,
  checks: audit.summary.total,
  calibration_pack: audit.checks.find((check) => check.id === 'calibration_pack_v03')?.evidence?.reviewers?.map((reviewer) => reviewer.rows) ?? [],
}, null, 2))
