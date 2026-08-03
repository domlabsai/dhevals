import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const directory = mkdtempSync(join(tmpdir(), 'dhevals-calibration-handoff-'))
const output = join(directory, 'handoff.json')
const publicOutput = join(directory, 'public-handoff.json')
const result = spawnSync(process.execPath, ['scripts/build-calibration-handoff.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, DHEVALS_CALIBRATION_HANDOFF_OUTPUT: output, DHEVALS_CALIBRATION_HANDOFF_PUBLIC_OUTPUT: publicOutput },
})
if (result.status !== 0) {
  process.stderr.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  process.exit(result.status ?? 1)
}
const handoff = JSON.parse(readFileSync(output, 'utf8'))
if (handoff.kind !== 'dhevals_calibration_handoff') throw new Error('handoff kind mismatch')
if (handoff.status !== 'ready_for_review') throw new Error(`unexpected handoff status: ${handoff.status}`)
if (handoff.review_policy.required_groups !== 300) throw new Error('handoff group count mismatch')
if (handoff.reviewers.length !== 2 || handoff.reviewers.some((reviewer) => reviewer.rows !== 300 || reviewer.scored_rows !== 0 || !reviewer.sha256)) throw new Error('handoff reviewer coverage mismatch')
if (handoff.safety.reviewer_scores_fabricated !== false || handoff.safety.secrets_recorded !== false) throw new Error('handoff safety contract mismatch')
if (/(?:api[_-]?key|authorization|password|client[_-]?secret|access[_-]?token)\s*[:=]\s*[^\s,}]+/i.test(JSON.stringify(handoff))) throw new Error('handoff contains a credential-looking value')

console.log(JSON.stringify({
  status: 'passed',
  handoff: handoff.status,
  suite_version: handoff.suite.version,
  reviewers: handoff.reviewers.map((reviewer) => ({ id: reviewer.reviewer_id, rows: reviewer.rows, scored: reviewer.scored_rows })),
}, null, 2))
