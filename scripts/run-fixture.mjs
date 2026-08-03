import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { verifyRunArtifact } from './verify-run.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const publicOutput = resolve(root, 'public/data/latest-run.json')
const suitePath = process.env.DHEVALS_SUITE_PATH || 'benchmarks/suites/heavy-user-ptbr/v0.1/suite.json'
const fixturePath = process.env.DHEVALS_FIXTURE_PATH || 'benchmarks/suites/heavy-user-ptbr/v0.1/fixtures/sacilm-fixture.json'
const reportOutput = resolve(root, process.env.DHEVALS_REPORT_OUTPUT || 'reports/fixtures/sacilm-heavy-user-fixture-run.json')
const verificationOutput = reportOutput.replace(/\.json$/, '.verification.json')
const publicVerificationOutput = resolve(root, 'public/data/latest-verification.json')
const modelId = process.env.DHEVALS_MODEL_ID || 'sacilm'
const checkpoint = process.env.DHEVALS_CHECKPOINT || 'fixture-snapshot'
const runtime = process.env.DHEVALS_RUNTIME || 'offline-fixture'
const trainingCommit = process.env.DHEVALS_TRAINING_COMMIT || 'fixture-development'
const runId = process.env.DHEVALS_RUN_ID || `fixture-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`

mkdirSync(resolve(root, 'public/data'), { recursive: true })
mkdirSync(resolve(reportOutput, '..'), { recursive: true })

const command = spawnSync('uv', [
  'run', '--python', '3.12', '--project', 'packages/dhevals_core', 'dhevals-run',
  '--suite', suitePath,
  '--fixture', fixturePath,
  '--model-id', modelId,
  '--checkpoint', checkpoint,
  '--runtime', runtime,
  '--training-commit', trainingCommit,
  '--run-id', runId,
  '--output', 'public/data/latest-run.json',
], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })

process.stdout.write(command.stdout || '')
process.stderr.write(command.stderr || '')
if (command.status !== 0) process.exit(command.status ?? 1)

const runVerification = verifyRunArtifact({ artifactPath: publicOutput, suitePath: resolve(root, suitePath), outputPath: verificationOutput })
if (runVerification !== 0) {
  console.error('Run artifact failed reproducibility verification; refusing to promote it.')
  process.exit(runVerification)
}

copyFileSync(publicOutput, reportOutput)
const reportBuild = spawnSync(process.execPath, ['scripts/build-report-artifacts.mjs'], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
process.stdout.write(reportBuild.stdout || '')
process.stderr.write(reportBuild.stderr || '')
if (reportBuild.status !== 0) process.exit(reportBuild.status ?? 1)
const reportVerification = verifyRunArtifact({
  artifactPath: publicOutput,
  suitePath: resolve(root, suitePath),
  reportPath: resolve(root, 'public/data/latest-report.json'),
  outputPath: verificationOutput,
})
if (reportVerification !== 0) {
  console.error('Derived report failed reproducibility verification; refusing to continue.')
  process.exit(reportVerification)
}
copyFileSync(verificationOutput, publicVerificationOutput)
const derivedReportOutput = reportOutput.replace(/\.json$/, '.report.json')
const derivedYoutubeOutput = reportOutput.replace(/\.json$/, '.youtube.json')
const derivedHtmlOutput = reportOutput.replace(/\.json$/, '.html')
const derivedCsvOutput = reportOutput.replace(/\.json$/, '.csv')
if (existsSync(resolve(root, 'public/data/latest-report.json'))) copyFileSync(resolve(root, 'public/data/latest-report.json'), derivedReportOutput)
if (existsSync(resolve(root, 'public/data/latest-youtube-pack.json'))) copyFileSync(resolve(root, 'public/data/latest-youtube-pack.json'), derivedYoutubeOutput)
if (existsSync(resolve(root, 'public/data/latest-report.html'))) copyFileSync(resolve(root, 'public/data/latest-report.html'), derivedHtmlOutput)
if (existsSync(resolve(root, 'public/data/latest-results.csv'))) copyFileSync(resolve(root, 'public/data/latest-results.csv'), derivedCsvOutput)
const leaderboardBuild = spawnSync(process.execPath, ['scripts/build-leaderboard.mjs'], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
process.stdout.write(leaderboardBuild.stdout || '')
process.stderr.write(leaderboardBuild.stderr || '')
if (leaderboardBuild.status !== 0) process.exit(leaderboardBuild.status ?? 1)
const calibrationBuild = spawnSync(process.execPath, ['scripts/build-calibration-progress.mjs'], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
process.stdout.write(calibrationBuild.stdout || '')
process.stderr.write(calibrationBuild.stderr || '')
if (calibrationBuild.status !== 0) process.exit(calibrationBuild.status ?? 1)
const releaseGateBuild = spawnSync(process.execPath, ['scripts/build-release-gate.mjs'], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
process.stdout.write(releaseGateBuild.stdout || '')
process.stderr.write(releaseGateBuild.stderr || '')
if (releaseGateBuild.status !== 0) process.exit(releaseGateBuild.status ?? 1)
const suiteCatalogBuild = spawnSync(process.execPath, ['scripts/build-suite-catalog.mjs'], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
process.stdout.write(suiteCatalogBuild.stdout || '')
process.stderr.write(suiteCatalogBuild.stderr || '')
if (suiteCatalogBuild.status !== 0) process.exit(suiteCatalogBuild.status ?? 1)
const runCatalogBuild = spawnSync(process.execPath, ['scripts/build-run-catalog.mjs'], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
process.stdout.write(runCatalogBuild.stdout || '')
process.stderr.write(runCatalogBuild.stderr || '')
if (runCatalogBuild.status !== 0) process.exit(runCatalogBuild.status ?? 1)
const modelCatalogBuild = spawnSync(process.execPath, ['scripts/build-model-catalog.mjs'], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
process.stdout.write(modelCatalogBuild.stdout || '')
process.stderr.write(modelCatalogBuild.stderr || '')
if (modelCatalogBuild.status !== 0) process.exit(modelCatalogBuild.status ?? 1)
const calibrationReviewDataBuild = spawnSync(process.execPath, ['scripts/build-calibration-review-data.mjs'], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
process.stdout.write(calibrationReviewDataBuild.stdout || '')
process.stderr.write(calibrationReviewDataBuild.stderr || '')
if (calibrationReviewDataBuild.status !== 0) process.exit(calibrationReviewDataBuild.status ?? 1)
const testMatrixBuild = spawnSync(process.execPath, ['scripts/build-test-matrix.mjs', 'build'], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
process.stdout.write(testMatrixBuild.stdout || '')
process.stderr.write(testMatrixBuild.stderr || '')
if (testMatrixBuild.status !== 0) process.exit(testMatrixBuild.status ?? 1)
for (const script of ['scripts/build-dataset-catalog.mjs', 'scripts/build-experiment-catalog.mjs', 'scripts/build-comparison-execution.mjs', 'scripts/build-scorecard.mjs']) {
  const catalogBuild = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf-8', stdio: 'pipe' })
  process.stdout.write(catalogBuild.stdout || '')
  process.stderr.write(catalogBuild.stderr || '')
  if (catalogBuild.status !== 0) process.exit(catalogBuild.status ?? 1)
}
console.log(`Updated ${publicOutput}`)
console.log(`Archived ${reportOutput}`)
console.log(`Derived ${derivedReportOutput}`)
console.log(`Derived ${derivedYoutubeOutput}`)
console.log(`Derived ${derivedHtmlOutput}`)
console.log(`Derived ${derivedCsvOutput}`)
