import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveSacilmManifestPath } from './sacilm-manifest-path.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const reportOutput = resolve(root, process.env.DHEVALS_GOAL_AUDIT_OUTPUT || 'reports/audits/dhevals-goal-latest.json')
const publicOutput = resolve(root, process.env.DHEVALS_GOAL_AUDIT_PUBLIC_OUTPUT || 'public/data/latest-goal-audit.json')
const checks = []

const suiteCatalog = readJson('public/data/suite-catalog.json')
const matrixCatalog = readJson('public/data/test-matrix-catalog.json')
const matrixExecution = readJson('public/data/test-execution-latest.json')
const comparison = readJson('public/data/comparison-execution-latest.json')
const readiness = readJson('public/data/latest-sacilm-readiness.json')
const releaseGate = readJson('public/data/latest-release-gate.json')
const latestRun = readJson('public/data/latest-run.json')
const judgeArtifact = readJson('public/data/latest-judge.json')
const calibrationV03 = readJson('public/data/calibration/v0.3/progress.json')
const calibrationHandoff = readJson('public/data/calibration/v0.3/handoff.json')
const manifestRelativePath = resolveSacilmManifestPath(root, process.env.DHEVALS_SACILM_MODEL_MANIFEST)
const manifest = readJson(manifestRelativePath)
const sacilmDeferred = ['standby', 'deferred', 'paused'].includes(String(process.env.DHEVALS_SACILM_EVALUATION_MODE || 'standby').toLowerCase())

const versionedSuites = ['0.2.0', '0.3.0']
const catalogVersions = new Set((suiteCatalog?.versions || suiteCatalog?.suites || []).map((entry) => entry.version))
const matrixVersions = new Set((matrixCatalog?.versions || []).map((entry) => entry.version))
check('versioned_suites', catalogVersions.has('0.2.0') && catalogVersions.has('0.3.0') && matrixVersions.size >= 2, {
  suite_catalog: 'public/data/suite-catalog.json',
  matrix_catalog: 'public/data/test-matrix-catalog.json',
  versions: versionedSuites.filter((version) => catalogVersions.has(version) && matrixVersions.has(version)),
}, 'suite catalog ou matrix catalog não cobre v0.2 e v0.3')

const executionEntries = Array.isArray(matrixExecution?.entries) ? matrixExecution.entries : []
const executionReady = matrixExecution?.status === 'ready' && executionEntries.length >= 2 && executionEntries.every((entry) => (
  entry?.scenarios?.positive?.status === 'verified'
  && entry?.scenarios?.negative?.status === 'verified'
  && entry?.matrix?.scorecard_dimension_count === 14
))
check('matrix_execution', executionReady, {
  artifact: 'public/data/test-execution-latest.json',
  entries: executionEntries.length,
  scenarios: matrixExecution?.coverage?.scenario_count ?? null,
  scorecard_dimensions: matrixExecution?.coverage?.scorecard_dimension_count ?? null,
}, 'test-execution-latest não comprova os cenários positivo/negativo das versões')

const requiredArtifacts = [
  'public/data/latest-run.json',
  'public/data/latest-report.json',
  'public/data/latest-report.html',
  'public/data/latest-results.csv',
  'public/data/latest-youtube-pack.json',
  'public/data/latest-verification.json',
  'public/data/latest-scorecard.json',
  'public/data/latest-judge.json',
]
const missingArtifacts = requiredArtifacts.filter((path) => !existsSync(resolve(root, path)))
check('derived_artifacts', missingArtifacts.length === 0, {
  required: requiredArtifacts,
  missing: missingArtifacts,
}, 'faltam artefatos derivados para alimentar console e modo YouTube')

const blueprintComponents = {
  benchmark_engine: ['packages/dhevals_core/src/dhevals_core/models.py', 'packages/dhevals_core/src/dhevals_core/grading.py', 'packages/dhevals_core/src/dhevals_core/audit.py'],
  dataset_registry: ['scripts/build-dataset-catalog.mjs', 'public/data/dataset-catalog.json'],
  evaluation_runner: ['packages/dhevals_core/src/dhevals_core/runner.py', 'packages/dhevals_core/src/dhevals_core/adapters.py', 'scripts/run-model.mjs'],
  judge_engine: ['packages/dhevals_core/src/dhevals_core/judge.py', 'packages/dhevals_core/src/dhevals_core/judge_runner.py'],
  human_evaluation_module: ['packages/dhevals_core/src/dhevals_core/calibration.py', 'packages/dhevals_core/src/dhevals_core/calibration_sheet.py', 'src/CalibrationReviewer.jsx'],
  safety_evaluation_suite: ['packages/dhevals_core/src/dhevals_core/safety.py', 'benchmarks/evaluations/safety-ptbr/v0.1/suite.json'],
  agent_evaluation_suite: ['packages/dhevals_core/src/dhevals_core/agent.py', 'benchmarks/evaluations/agent-ptbr/v0.1/policy.json'],
  dashboard: ['src/App.jsx', 'dist/index.html'],
  api: ['scripts/dhevals-api-server.mjs', 'scripts/test-dhevals-api.mjs'],
  leaderboard: ['packages/dhevals_core/src/dhevals_core/leaderboard.py', 'scripts/build-leaderboard.mjs', 'public/data/leaderboard.json'],
  scorecards: ['packages/dhevals_core/src/dhevals_core/scorecard.py', 'public/data/latest-scorecard.json'],
  experiment_tracking: ['scripts/build-experiment-catalog.mjs', 'public/data/experiment-catalog.json'],
  reporting_engine: ['packages/dhevals_core/src/dhevals_core/reporting.py', 'scripts/build-report-artifacts.mjs', 'public/data/latest-report.json'],
}
const blueprintComponentEvidence = Object.fromEntries(Object.entries(blueprintComponents).map(([component, paths]) => [component, {
  required: paths,
  missing: paths.filter((path) => !existsSync(resolve(root, path))),
}]))
const missingBlueprintComponents = Object.fromEntries(Object.entries(blueprintComponentEvidence).filter(([, evidence]) => evidence.missing.length > 0))
check('blueprint_components', Object.keys(missingBlueprintComponents).length === 0, {
  source: 'DOM_Labs_Master_Research_Blueprint.md §13.1',
  components: blueprintComponentEvidence,
}, 'um componente da arquitetura DHEvals do Blueprint não possui evidência local')

const judgeStatuses = new Set(['not_evaluated', 'draft', 'evaluated', 'ready', 'invalid'])
const judgeEvaluations = Array.isArray(judgeArtifact?.evaluations) ? judgeArtifact.evaluations : null
const judgeContractReady = judgeArtifact?.kind === 'dhevals_judge_artifact'
  && judgeArtifact?.schema_version === '0.1.0'
  && judgeStatuses.has(judgeArtifact?.status)
  && typeof judgeArtifact?.judge_model?.id === 'string'
  && judgeArtifact.judge_model.id.trim().length > 0
  && typeof judgeArtifact?.rubric_hash === 'string'
  && judgeArtifact.rubric_hash.trim().length > 0
  && judgeEvaluations !== null
  && (judgeArtifact.status === 'not_evaluated' ? judgeArtifact.score === null : true)
check('judge_artifact_contract', judgeContractReady, {
  artifact: 'public/data/latest-judge.json',
  status: judgeArtifact?.status ?? 'missing',
  evaluations: judgeEvaluations?.length ?? null,
  score: judgeArtifact?.score ?? null,
  independent_from_quality: judgeArtifact?.metadata?.independent_from_quality ?? null,
}, 'o artefato público do judge não respeita o contrato explícito de avaliação independente')

const registryPaths = [
  'public/data/dataset-catalog.json',
  'public/data/experiment-catalog.json',
  'public/data/model-catalog.json',
  'public/data/run-catalog.json',
]
const missingRegistries = registryPaths.filter((path) => !existsSync(resolve(root, path)))
check('registries', missingRegistries.length === 0, { required: registryPaths, missing: missingRegistries }, 'um registry derivado não está disponível')

const scorecardCoverage = matrixCatalog?.versions?.[0]?.scorecard_dimensions || []
const scorecardDimensions = new Set(scorecardCoverage.map((entry) => entry.dimension))
const matrixCatalogVersions = Array.isArray(matrixCatalog?.versions) ? matrixCatalog.versions : []
check('scorecard_coverage', scorecardDimensions.size === 14 && matrixCatalogVersions.length >= 2 && matrixCatalogVersions.every((entry) => entry.scorecard_dimension_count === 14 && entry.scorecard_dimensions?.length === 14), {
  dimensions: scorecardDimensions.size,
  artifact: 'public/data/test-matrix-catalog.json',
}, 'o catálogo não expõe as 14 dimensões de scorecard')

const independentPaths = [
  'benchmarks/evaluations/safety-ptbr/v0.1/suite.json',
  'benchmarks/evaluations/safety-ptbr/v0.1/fixture.json',
  'benchmarks/evaluations/agent-ptbr/v0.1/policy.json',
  'benchmarks/evaluations/agent-ptbr/v0.1/traces-fixture.json',
  'packages/dhevals_core/src/dhevals_core/judge_runner.py',
  'scripts/test-judge-runner.mjs',
  'packages/dhevals_core/tests/test_grader_matrix.py',
]
const missingIndependent = independentPaths.filter((path) => !existsSync(resolve(root, path)))
check('independent_contracts', missingIndependent.length === 0, { required: independentPaths, missing: missingIndependent }, 'contratos independentes de judge/safety/agent ou grader matrix ausentes')

const comparisonModels = Array.isArray(comparison?.models) ? comparison.models : []
const comparisonLocked = comparisonModels.length >= 1 && comparisonModels.every((model) => model.score === null && model.score_status === 'locked_until_release_gate')
const comparisonPrimaryValid = typeof comparison?.primary_model_id === 'string' && comparisonModels.some((model) => model.id === comparison.primary_model_id)
check('comparison_contract', comparison?.kind === 'dhevals_comparison_execution' && comparisonLocked && comparisonPrimaryValid && comparison?.policy?.same_suite_hash_required === true, {
  artifact: 'public/data/comparison-execution-latest.json',
  models: comparisonModels.map((model) => model.id),
  primary_model_id: comparison?.primary_model_id ?? null,
  status: comparison?.status ?? null,
  scores_locked: comparisonLocked,
}, 'comparison contract não mantém as lanes registradas na mesma suíte com scores bloqueados')

const pack = readJson('reports/calibration/heavy-user-ptbr-v0.3-blind/pack.json')
const reviewerSheets = ['reviewer-a.csv', 'reviewer-b.csv'].map((name) => {
  const path = `reports/calibration/heavy-user-ptbr-v0.3-blind/${name}`
  const rows = existsSync(resolve(root, path)) ? parseCsv(readFileSync(resolve(root, path), 'utf8')) : []
  return { name, path, rows: Math.max(0, rows.length - 1), scored: rows.slice(1).filter((row) => String(row[6] || '').trim() !== '').length }
})
const calibrationPackReady = pack?.kind === 'dhevals_calibration_pack' && pack.required_groups === 300 && reviewerSheets.every((sheet) => sheet.rows === 300 && sheet.scored === 0)
check('calibration_pack_v03', calibrationPackReady, {
  pack: 'reports/calibration/heavy-user-ptbr-v0.3-blind/pack.json',
  required_groups: pack?.required_groups ?? null,
  reviewers: reviewerSheets,
}, 'o pacote cego v0.3 não cobre 300 grupos por revisor sem fabricar notas')

const handoffReviewers = Array.isArray(calibrationHandoff?.reviewers) ? calibrationHandoff.reviewers : []
const handoffReady = calibrationHandoff?.kind === 'dhevals_calibration_handoff'
  && ['ready_for_review', 'in_progress', 'ready_to_import'].includes(calibrationHandoff.status)
  && calibrationHandoff.review_policy?.required_groups === 300
  && handoffReviewers.length === 2
  && handoffReviewers.every((reviewer) => reviewer.rows === 300 && reviewer.sha256)
check('calibration_handoff', handoffReady, {
  artifact: 'public/data/calibration/v0.3/handoff.json',
  status: calibrationHandoff?.status ?? 'missing',
  reviewers: handoffReviewers.map((reviewer) => ({ id: reviewer.reviewer_id, rows: reviewer.rows, scored: reviewer.scored_rows })),
}, 'gere o handoff v0.3 antes de distribuir as planilhas aos revisores')

const consoleReady = existsSync(resolve(root, 'dist/index.html')) && existsSync(resolve(root, 'e2e/dhevals-console.spec.mjs'))
check('console_e2e_surface', consoleReady, { build: 'dist/index.html', test: 'e2e/dhevals-console.spec.mjs' }, 'build ou teste Playwright da console não está disponível')

if (sacilmDeferred) {
  const evidence = { mode: 'standby', model: 'sacilm', reason: 'SaciLM ainda não entrou em desenvolvimento; a lane de avaliação permanece opcional.' }
  for (const id of ['sacilm_manifest', 'sacilm_endpoint', 'sacilm_preflight', 'sacilm_real_run']) check(id, 'deferred', evidence, 'retomar esta lane quando o SaciLM estiver pronto')
} else {
  const manifestReady = manifest?.status === 'ready'
  check('sacilm_manifest', manifestReady ? 'ready' : 'pending', {
    manifest: manifestRelativePath,
    status: manifest?.status ?? 'missing',
    post_training_tool: manifest?.post_training?.tool ?? null,
    training_provider: manifest?.training_runtime?.provider ?? null,
  }, 'finalize o manifesto com checkpoint, dataset, commit e runtime concretos')

  const endpoint = process.env.DHEVALS_SACILM_BASE_URL
  const endpointReady = safeUrl(endpoint)
  check('sacilm_endpoint', endpointReady ? 'ready' : 'blocked', {
    configured: Boolean(endpoint),
    recorded: false,
  }, endpoint ? 'DHEVALS_SACILM_BASE_URL não é uma URL http(s) segura' : 'DHEVALS_SACILM_BASE_URL não está configurado')

  const preflight = readJson('reports/preflight/sacilm-latest.json')
  check('sacilm_preflight', preflight?.status === 'ready' ? 'ready' : 'pending', {
    artifact: 'reports/preflight/sacilm-latest.json',
    status: preflight?.status ?? 'missing',
  }, 'execute npm run preflight:sacilm depois de configurar o endpoint real')

  const realRun = latestRun?.run?.model?.provider && latestRun.run.model.provider !== 'fixture'
  check('sacilm_real_run', realRun ? 'ready' : 'pending', {
    run_id: latestRun?.run?.id ?? null,
    provider: latestRun?.run?.model?.provider ?? null,
  }, 'a baseline pública ainda é uma fixture; execute uma primeira rodada real quando uma lane estiver pronta')
}

check('human_calibration_v03', calibrationV03?.ready === true && calibrationV03?.status === 'ready' ? 'ready' : 'pending', {
  artifact: 'public/data/calibration/v0.3/progress.json',
  completed_groups: calibrationV03?.completed_groups ?? 0,
  required_groups: calibrationV03?.required_groups ?? 300,
  reviewers_required: 2,
}, 'importe duas revisões independentes, adjudique desacordos e congele a rubrica')

check('release_gate', releaseGate?.status === 'ready' ? 'ready' : 'pending', {
  artifact: 'public/data/latest-release-gate.json',
  status: releaseGate?.status ?? 'missing',
  errors: releaseGate?.errors?.length ?? null,
}, 'o release gate permanece bloqueado até manifesto, rodada real e calibração passarem')

const localIds = new Set(['versioned_suites', 'matrix_execution', 'derived_artifacts', 'registries', 'scorecard_coverage', 'independent_contracts', 'comparison_contract', 'calibration_pack_v03', 'calibration_handoff', 'console_e2e_surface'])
const externalIds = new Set(['sacilm_manifest', 'sacilm_endpoint', 'sacilm_preflight', 'sacilm_real_run', 'human_calibration_v03', 'release_gate'])
const localStatus = aggregate(localIds)
const externalStatus = aggregate(externalIds)
const status = aggregate(new Set(checks.map((entry) => entry.id)))
const artifact = {
  kind: 'dhevals_goal_audit',
  schema_version: '0.1.0',
  objective: 'E2E do DHEvals e matriz heavy-user calibrada para lanes de modelos configuráveis; SaciLM é opcional',
  status,
  local_status: localStatus,
  external_status: externalStatus,
  summary: {
    total: checks.length,
    ready: checks.filter((entry) => entry.status === 'ready').length,
    pending: checks.filter((entry) => entry.status === 'pending').length,
    blocked: checks.filter((entry) => entry.status === 'blocked').length,
    deferred: checks.filter((entry) => entry.status === 'deferred').length,
  },
  checks,
  next_actions: checks.filter((entry) => entry.status !== 'ready').map((entry) => entry.reason).filter(Boolean),
  safety: { secrets_recorded: false, endpoint_value_recorded: false },
  generated_at: new Date().toISOString(),
}

mkdirSync(resolve(reportOutput, '..'), { recursive: true })
writeFileSync(reportOutput, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
if (publicOutput !== reportOutput) {
  mkdirSync(resolve(publicOutput, '..'), { recursive: true })
  writeFileSync(publicOutput, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
}

console.log(JSON.stringify({
  status,
  local_status: localStatus,
  external_status: externalStatus,
  ready: artifact.summary.ready,
  pending: artifact.summary.pending,
  blocked: artifact.summary.blocked,
  report: relative(root, reportOutput),
  public_output: relative(root, publicOutput),
}, null, 2))

if (process.argv.includes('--strict') && status !== 'ready') process.exit(2)
if (process.argv.includes('--strict-local') && localStatus !== 'ready') process.exit(2)

function check(id, statusOrReady, evidence, reason) {
  const status = statusOrReady === true ? 'ready' : statusOrReady === false ? 'blocked' : statusOrReady
  checks.push({ id, status, evidence, reason: status === 'ready' ? null : reason })
}

function aggregate(ids) {
  const selected = checks.filter((entry) => ids.has(entry.id))
  if (selected.some((entry) => entry.status === 'blocked')) return 'blocked'
  if (selected.some((entry) => entry.status === 'pending')) return 'pending'
  if (selected.some((entry) => entry.status === 'deferred')) return 'deferred'
  return selected.length ? 'ready' : 'blocked'
}

function readJson(relativePath) {
  const path = resolve(root, relativePath)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function safeUrl(value) {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const source = String(text || '').replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') quoted = false
      else cell += character
    } else if (character === '"' && cell.length === 0) quoted = true
    else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      cell = ''
    } else cell += character
  }
  if (quoted) return []
  if (row.length > 0 || cell !== '') {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
