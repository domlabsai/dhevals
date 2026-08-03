import { expect, test } from 'playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifactPath = resolve(root, 'public/data/latest-run.json')

function runFixture(runId) {
  execFileSync('node', ['scripts/run-calibration-fixture.mjs'], {
    cwd: root,
    env: { ...process.env, DHEVALS_RUN_ID: runId },
    encoding: 'utf8',
    stdio: 'pipe',
  })
  return JSON.parse(readFileSync(artifactPath, 'utf8'))
}

test.beforeAll(() => {
  runFixture('e2e-fixture-initial')
})

test('executes a fixture run, syncs the artifact, and updates the presentation surface', async ({ page }) => {
  const initialArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'))

  await page.goto('/')
  await expect(page).toHaveTitle(/DHEvals · Run overview/)
  await expect(page.getByTestId('sync-state')).toContainText('run artifact synced')
  await expect(page.getByTestId('run-id')).toHaveText(initialArtifact.run.id)
  await expect(page.getByTestId('overall-score')).toContainText('100.0')
  await expect(page.getByTestId('completed-count')).toContainText('10 of 10 tasks completed')

  await page.getByRole('button', { name: 'Runs' }).click()
  await expect(page.getByTestId('run-history')).toContainText(initialArtifact.run.id)
  await expect(page.getByTestId('run-history')).toContainText('offline fixture')
  await expect(page.getByTestId('experiment-registry')).toContainText('Immutable run lineage')
  await page.getByRole('button', { name: 'Models' }).click()
  await expect(page.getByTestId('view-models')).toContainText('Comparison registry')
  await expect(page.getByTestId('view-models')).toContainText('GPT-4 Turbo baseline')
  await expect(page.getByTestId('comparison-execution-contract')).toContainText('Same-suite lanes with release-locked scores')
  await expect(page.getByTestId('comparison-execution-contract')).toContainText('locked')
  await page.getByRole('button', { name: 'Reports' }).click()
  await expect(page.getByTestId('view-reports')).toContainText('Factual hook')
  await expect(page.getByRole('link', { name: 'Open HTML report' })).toHaveAttribute('href', '/data/latest-report.html')
  await expect(page.getByTestId('scorecard-contract')).toContainText('Transparent scorecard')
  await expect(page.getByTestId('scorecard-contract')).toContainText('not evaluated')
  await expect(page.getByTestId('judge-contract')).toContainText('Independent LLM-as-a-Judge')
  await expect(page.getByTestId('judge-contract')).toContainText('not_evaluated')
  await expect(page.getByRole('link', { name: 'Open judge artifact' })).toHaveAttribute('href', '/data/latest-judge.json')
  const csvDownloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download CSV' }).click()
  const csvDownload = await csvDownloadPromise
  expect(csvDownload.suggestedFilename()).toBe('latest-results.csv')
  await page.getByRole('button', { name: 'Benchmarks' }).click()
  await expect(page.getByTestId('view-benchmarks')).toContainText('Draft · publication locked')
  await expect(page.getByTestId('test-matrix-contract')).toContainText('40')
  await expect(page.getByTestId('test-matrix-contract')).toContainText('300')
  await expect(page.getByTestId('test-matrix-contract')).toContainText('Scorecard dimensions')
  await expect(page.getByTestId('test-matrix-contract')).toContainText('14')
  await expect(page.getByTestId('matrix-execution-contract')).toContainText('Positive and negative scenarios verified')
  await expect(page.getByTestId('matrix-execution-contract')).toContainText('verified')
  await page.getByRole('button', { name: 'Calibration' }).click()
  await expect(page.getByTestId('calibration-status')).toContainText('pending')
  await expect(page.getByTestId('calibration-progress')).toContainText('0 of 150 groups')
  await expect(page.getByTestId('view-calibration')).toContainText('pack.json')
  await expect(page.getByTestId('expanded-calibration-progress')).toContainText('0 of 300 groups')
  await expect(page.getByTestId('calibration-handoff')).toContainText('ready_for_review')
  await expect(page.getByTestId('calibration-handoff')).toContainText('Reviewer A')
  await expect(page.getByRole('link', { name: 'Open handoff' })).toHaveAttribute('href', '/data/calibration/v0.3/handoff.json')
  await page.getByRole('button', { name: 'Open reviewer workspace' }).click()
  await expect(page.getByTestId('calibration-reviewer')).toContainText('Anchor review workspace')
  await expect(page.getByTestId('review-progress')).toContainText('0 / 300')
  await page.getByTestId('score-4').click()
  await expect(page.getByTestId('review-progress')).toContainText('1 / 300')
  await page.getByRole('button', { name: 'Next unscored' }).click()
  const blindCsvDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export blind CSV' }).click()
  const blindCsvDownload = await blindCsvDownloadPromise
  expect(blindCsvDownload.suggestedFilename()).toBe('reviewer-a.csv')
  const blindCsvPath = await blindCsvDownload.path()
  expect(readFileSync(blindCsvPath, 'utf8')).toContain('task_id,dimension_id,dimension_guidance,anchor_level,example_output,example_target,score,notes')
  await page.getByTestId('review-csv-input').setInputFiles({ name: 'reviewer-a.csv', mimeType: 'text/csv', buffer: readFileSync(blindCsvPath) })
  await expect(page.getByTestId('csv-validation')).toContainText('Validated reviewer-a.csv · 300 rows · 1 scored')
  await page.getByRole('button', { name: 'Exit reviewer workspace' }).click()
  await expect(page.getByTestId('calibration-status')).toContainText('pending')
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByTestId('view-settings')).toContainText('Verification')
  await expect(page.getByTestId('view-settings')).toContainText('SaciLM readiness')
  await expect(page.getByTestId('goal-audit-contract')).toContainText('Local path verified')
  await expect(page.getByTestId('goal-audit-contract')).toContainText('ready')
  await expect(page.getByRole('link', { name: 'Open calibration handoff' })).toHaveAttribute('href', '/data/calibration/v0.3/handoff.json')
  await expect(page.getByTestId('sacilm-readiness-checklist')).toContainText('SaciLM readiness checklist')
  await expect(page.getByTestId('sacilm-readiness-checklist')).toContainText('DHEVALS_SACILM_BASE_URL')
  await expect(page.getByTestId('sacilm-readiness-checklist')).toContainText('Open run checklist')
  const checklistResponse = await page.request.get('/docs/dhevals-sacilm-run-checklist.md')
  expect(checklistResponse.status()).toBe(200)
  expect(await checklistResponse.text()).toContain('# Checklist da primeira rodada real do SaciLM')
  await expect(page.getByTestId('view-settings')).toContainText('blocked')
  await expect(page.getByTestId('view-settings')).toContainText('valid')
  await expect(page.getByTestId('view-settings')).toContainText('Bundle audit')
  await expect(page.getByTestId('view-settings')).toContainText('ready')
  await expect(page.getByTestId('view-settings')).toContainText('Release gate')
  await expect(page.getByTestId('view-settings')).toContainText('blocked')
  await page.getByRole('button', { name: 'Datasets' }).click()
  await expect(page.getByTestId('view-datasets')).toContainText('Versioned suite registry')
  await expect(page.getByTestId('dataset-registry')).toContainText('domhubs-heavy-user-ptbr')
  await expect(page.getByTestId('dataset-registry')).toContainText('PII prohibited')
  await expect(page.getByTestId('view-datasets')).toContainText('0.3.0')
  await expect(page.getByTestId('view-datasets')).toContainText('300')
  await page.getByRole('button', { name: 'Overview' }).click()

  await page.getByRole('row', { name: /Research under conflicting evidence Research Completed/ }).click()
  await expect(page.getByRole('heading', { name: 'Research under conflicting evidence' })).toBeVisible()
  await expect(page.locator('.evidence-copy')).toContainText('evidências')

  await page.getByRole('button', { name: /Sources/ }).click()
  await expect(page.getByText('suite/heavy-user/v0.2')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data' }).click()
  const download = await downloadPromise
  await expect(download.suggestedFilename()).toBe(`dhevals-${initialArtifact.run.id}.json`)

  await page.getByRole('button', { name: 'Director view' }).click()
  await expect(page.getByRole('button', { name: 'Exit director' })).toBeVisible()
  await expect(page.getByTestId('director-brief')).toContainText(/sacilm.*alcançou/i)
  const youtubeDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export YouTube pack' }).click()
  const youtubeDownload = await youtubeDownloadPromise
  expect(youtubeDownload.suggestedFilename()).toBe(`dhevals-${initialArtifact.run.id}-youtube-pack.json`)

  const refreshedArtifact = runFixture('e2e-fixture-refresh')
  await page.getByRole('button', { name: 'Refresh run' }).click()
  await expect(page.getByRole('status')).toContainText('Atualizando artefato')
  await expect(page.getByTestId('run-id')).toHaveText(refreshedArtifact.run.id)
})

test('keeps the evidence surface usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('sync-state')).toContainText('run artifact synced')
  await expect(page.locator('.navigation-rail')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible()
  await page.getByRole('button', { name: 'Reports' }).click()
  await expect(page.getByTestId('judge-contract')).toBeVisible()
  await expect(page.getByTestId('scorecard-contract')).toBeVisible()
  expect(await page.locator('.primary-nav').evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto')
  await page.getByRole('button', { name: 'Benchmarks' }).click()
  await expect(page.getByTestId('test-matrix-contract')).toBeVisible()
  expect(await page.locator('.table-scroll').first().evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto')
})
