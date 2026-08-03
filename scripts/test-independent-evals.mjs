import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const workspace = mkdtempSync(resolve(tmpdir(), 'dhevals-independent-'))
const publicScorecardBefore = existsSync(resolve(root, 'public/data/latest-scorecard.json'))
  ? readFileSync(resolve(root, 'public/data/latest-scorecard.json'), 'utf8')
  : null
const safetyOutput = resolve(workspace, 'safety.json')
const agentOutput = resolve(workspace, 'agent.json')
const judgeInput = resolve(workspace, 'judge-input.json')
const judgeOutput = resolve(workspace, 'judge.json')
writeFileSync(judgeInput, `${JSON.stringify({
  schema_version: '0.1.0',
  kind: 'dhevals_judge_artifact',
  status: 'evaluated',
  generated_at: new Date().toISOString(),
  judge_model: { id: 'judge-local-fixture' },
  rubric_hash: 'fixture-rubric-hash',
  evaluations: [{ task_id: 'judge-fixture-001', dimension_id: 'evidence', score: 1, evidence: 'fixture evidence' }],
  score: 1,
  metadata: { fixture_only: true },
}, null, 2)}\n`, 'utf8')

runUv(['dhevals-safety', '--suite', 'benchmarks/evaluations/safety-ptbr/v0.1/suite.json', '--fixture', 'benchmarks/evaluations/safety-ptbr/v0.1/fixture.json', '--output', safetyOutput], 'safety')
runUv(['dhevals-agent', '--policy', 'benchmarks/evaluations/agent-ptbr/v0.1/policy.json', '--traces', 'benchmarks/evaluations/agent-ptbr/v0.1/traces-fixture.json', '--output', agentOutput, '--model-id', 'sacilm'], 'agent')
runUv(['dhevals-judge', '--input', judgeInput, '--output', judgeOutput], 'judge')
const outputs = [safetyOutput, agentOutput, judgeOutput].map((path) => JSON.parse(readFileSync(path, 'utf8')))
if (outputs.some((artifact) => artifact.status !== 'evaluated' || artifact.score !== 1)) throw new Error('independent fixture lane did not produce evaluated score 1')
if (publicScorecardBefore !== null && readFileSync(resolve(root, 'public/data/latest-scorecard.json'), 'utf8') !== publicScorecardBefore) throw new Error('independent lanes mutated public scorecard')
console.log(JSON.stringify({ status: 'passed', lanes: outputs.map((artifact) => artifact.kind), scores: outputs.map((artifact) => artifact.score) }, null, 2))

function runUv(args, label) {
  const command = spawnSync('uv', ['run', '--python', '3.12', '--project', 'packages/dhevals_core', ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  process.stdout.write(command.stdout || '')
  process.stderr.write(command.stderr || '')
  if (command.status !== 0) throw new Error(`${label} lane failed with status ${command.status}`)
}
