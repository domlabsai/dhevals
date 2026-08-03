import { expect, test } from 'playwright/test'

/*
 * E2E coverage for the public platform served at `/` (the internal console
 * lives at `/console` and is covered by dhevals-console.spec.mjs).
 *
 * Run ids are volatile: archive-only runs are resolved from /data/public/runs.json
 * at test time, never hard-coded.
 */

/* Collect uncaught page exceptions so each test can assert a clean console. */
function watchPageErrors(page) {
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

async function fetchRunsIndex(page) {
  const response = await page.request.get('/data/public/runs.json')
  expect(response.status()).toBe(200)
  const index = await response.json()
  return index.entries ?? []
}

test('homepage presents the claim with evidence, not promoted-score hype', async ({ page }) => {
  const errors = watchPageErrors(page)

  await page.goto('/')
  await expect(page.getByTestId('home-page')).toBeVisible()
  await expect(page).toHaveTitle(/^DHEvals/)

  const hero = page.getByTestId('hero-claim')
  await expect(hero).toBeVisible()
  await expect(hero.getByRole('link', { name: 'Explore leaderboard' })).toHaveAttribute('href', '/leaderboard')

  // Featured signal: evidence badge carries a text label and the score stays
  // hidden because the latest model run is archive-only.
  const featured = page.getByTestId('featured-result')
  await expect(featured.getByTestId('evidence-badge')).toContainText('Locked')
  await expect(featured.locator('.display-lg')).toHaveText('—')
  await expect(featured).toContainText('Archive-only model evidence')
  await expect(featured).not.toContainText(/sacilm/i)

  // No promoted-score claim anywhere: the promoted band is an explicit empty
  // state and every decision card renders in its unavailable treatment.
  await expect(page.getByTestId('empty-state').first()).toContainText('No promoted results yet.')
  const decisionCards = page.getByTestId('decision-card')
  await expect(decisionCards).toHaveCount(3)
  for (let index = 0; index < 3; index += 1) {
    await expect(decisionCards.nth(index)).toHaveClass(/decision--unavailable/)
  }

  await expect(page.getByTestId('footer').getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/domlabsai/dhevals',
  )

  expect(errors).toEqual([])
})

test('leaderboard is honestly empty and filters round-trip through the URL', async ({ page }) => {
  const errors = watchPageErrors(page)

  await page.goto('/leaderboard')
  await expect(page.getByTestId('leaderboard-page')).toBeVisible()

  // Ranked section: designed EmptyState with a methodology link, not a table.
  const rankedSection = page.locator('section[aria-label="Ranked models"]')
  await expect(rankedSection.getByTestId('empty-state')).toContainText('No promoted results yet.')
  await expect(rankedSection.getByRole('link', { name: 'Read the methodology' })).toHaveAttribute(
    'href',
    '/methodology',
  )

  // Not-yet-ranked table lists every tracked model; missing metrics are "—".
  const table = page.getByTestId('leaderboard-table')
  await expect(table.locator('tbody tr')).toHaveCount(2)
  await expect(table).toContainText('—')

  // Copy/share control exists.
  await expect(page.getByTestId('share-menu')).toBeVisible()

  // URL filter round-trip: query params drive chips and rows.
  await page.goto('/leaderboard?q=deepseek&evidence=locked')
  await expect(page.getByTestId('filter-chip')).toHaveCount(2)
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await expect(table).toContainText('deepseek')

  // Removing the search chip updates the URL and widens the table.
  await page.getByRole('button', { name: /Remove filter Search/ }).click()
  await expect(page).toHaveURL((url) => !url.searchParams.has('q') && url.searchParams.get('evidence') === 'locked')
  await expect(page.getByTestId('filter-chip')).toHaveCount(1)
  await expect(table.locator('tbody tr')).toHaveCount(1)

  // Reset filters clears the query string entirely.
  await page.getByRole('button', { name: 'Reset filters' }).click()
  await expect(page).toHaveURL(/\/leaderboard$/)
  await expect(page.getByTestId('filter-chip')).toHaveCount(0)
  await expect(table.locator('tbody tr')).toHaveCount(2)

  expect(errors).toEqual([])
})

test('model page shows pending evidence and a designed not-found state', async ({ page }) => {
  const errors = watchPageErrors(page)

  await page.goto('/models/opencode-deepseek-v4-flash-free')
  await expect(page.getByTestId('model-page')).toBeVisible()

  const hero = page.getByTestId('score-hero')
  await expect(hero.locator('.display-lg')).toHaveText('—')
  await expect(hero.getByTestId('evidence-badge')).toContainText('Locked')

  await expect(page.getByTestId('timeline')).toBeVisible()
  await expect(page.getByTestId('model-page')).toContainText('Absence of a score is a state')

  await page.goto('/models/unknown-model')
  const notFound = page.getByTestId('model-page').getByTestId('empty-state')
  await expect(notFound).toContainText('not in the public projection')
  await expect(page.getByTestId('model-page').getByRole('link', { name: 'Back to leaderboard' })).toHaveAttribute(
    'href',
    '/leaderboard',
  )

  expect(errors).toEqual([])
})

test('compare canonicalizes the pair and never declares a winner', async ({ page }) => {
  const errors = watchPageErrors(page)

  // The picker renders without a pair.
  await page.goto('/compare')
  await expect(page.getByTestId('compare-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Side-by-side evidence' })).toBeVisible()

  // Canonical ordering is alphabetical: the reversed pair redirects.
  const slugs = ['baseline-gpt-4-turbo', 'opencode-deepseek-v4-flash-free']
  const canonical = [...slugs].sort().join('-vs-')
  const reversed = [...slugs].reverse().join('-vs-')
  await page.goto(`/compare/${reversed}`)
  await expect(page).toHaveURL(new RegExp(`/compare/${canonical}$`))

  // Not-comparable guard: no promoted scores exist on either side.
  await expect(page.getByTestId('compare-page')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('cannot be compared yet')

  // No winner is declared anywhere on the page.
  const pageText = await page.getByTestId('compare-page').innerText()
  expect(pageText).not.toMatch(/\bwins\b/i)

  // Heatmap present; every delta cell renders "—" (no ▲/▼ leads).
  const heatmap = page.getByTestId('comparison-heatmap')
  await expect(heatmap).toBeVisible()
  await expect(heatmap).not.toContainText('▲')
  await expect(heatmap).not.toContainText('▼')
  const deltaCells = page.locator('td.heatmap__cell')
  const cellCount = await deltaCells.count()
  expect(cellCount).toBeGreaterThan(0)
  for (let index = 0; index < cellCount; index += 1) {
    await expect(deltaCells.nth(index)).toHaveText('—')
  }

  expect(errors).toEqual([])
})

test('report pages label archive-only runs and expose the inauguration report', async ({ page }) => {
  const errors = watchPageErrors(page)

  /* ---- Archive-only report (run id resolved dynamically) ---- */
  const entries = await fetchRunsIndex(page)
  const archiveRun =
    entries.find((entry) => entry.run_status === 'archive_only' && entry.id.includes('-v03-final')) ??
    entries.find((entry) => entry.run_status === 'archive_only')
  expect(archiveRun, 'an archive-only run must exist in the public projection').toBeTruthy()
  expect(typeof archiveRun.quality_score).toBe('number')
  const archiveScore = archiveRun.quality_score.toFixed(1)
  const detailResponse = await page.request.get(`/data/public/runs/${archiveRun.id}.json`)
  expect(detailResponse.status()).toBe(200)
  const detail = await detailResponse.json()
  const firstTask = detail.tasks[0]
  expect(firstTask.prompt.length).toBeGreaterThan(20)

  await page.goto(`/reports/${archiveRun.id}`)
  await expect(page.getByTestId('report-page')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Archive only')
  await expect(page.getByTestId('score-hero').locator('.display-lg')).toHaveText(archiveScore)

  // Task table opens the run inspector with pt-BR prompt evidence.
  const taskTable = page.getByTestId('data-table')
  await expect(taskTable.locator('tbody tr').first()).toBeVisible()
  await page.getByRole('link', { name: /Inspect evidence for/ }).first().click()
  const inspector = page.getByTestId('run-inspector')
  await expect(inspector).toBeVisible()
  await expect(inspector.getByTestId('evidence-panel')).toContainText(firstTask.prompt.slice(0, 40))

  // Export menu links the JSON artifact.
  await page.getByTestId('export-menu').locator('summary').click()
  const artifactLink = page.getByTestId('export-menu').getByRole('link', { name: `${archiveRun.id}.json` })
  await expect(artifactLink).toHaveAttribute('href', `/data/public/runs/${archiveRun.id}.json`)

  await page.goto('/reports/inauguration')
  await expect(page.getByTestId('inauguration-page')).toBeVisible()
  await expect(page.getByTestId('inauguration-page')).toContainText('The first three stages are in.')
  await expect(page.getByTestId('inauguration-page')).toContainText('Stage 03')

  expect(errors).toEqual([])
})

test('benchmarks list versioned suites and the suite page shows calibration', async ({ page }) => {
  const errors = watchPageErrors(page)

  await page.goto('/benchmarks')
  await expect(page.getByTestId('benchmarks-page')).toBeVisible()
  const suiteRows = page.locator('.suite-row')
  await expect(suiteRows).toHaveCount(3)
  for (let index = 0; index < 3; index += 1) {
    await expect(suiteRows.nth(index)).toContainText('sha256:')
  }

  await page.goto('/benchmarks/heavy-user-ptbr-v0-2-0')
  const suitePage = page.getByTestId('suite-page')
  await expect(suitePage).toBeVisible()
  await expect(page.getByTestId('coverage-meter')).toContainText('0/150')
  await expect(suitePage).toContainText('0 of 150')
  await expect(suitePage).toContainText('sha256:')

  expect(errors).toEqual([])
})

test('reports index, methodology, data downloads, about, and 404', async ({ page }) => {
  const errors = watchPageErrors(page)

  // Reports index: run_status labels plus fixture labeling.
  await page.goto('/reports')
  await expect(page.getByTestId('reports-page')).toBeVisible()
  const table = page.getByTestId('data-table')
  await expect(table).toContainText('Locked')
  await expect(table).toContainText('Archive only')
  await expect(table).toContainText('Invalid')
  await expect(table).toContainText('Fixture')

  // Methodology: the five evidence states and the score formula.
  await page.goto('/methodology')
  const methodology = page.getByTestId('methodology-page')
  await expect(methodology).toBeVisible()
  for (const label of ['Supported', 'Estimated', 'Pending', 'Locked', 'Invalid']) {
    await expect(methodology.getByTestId('evidence-badge').filter({ hasText: label }).first()).toBeVisible()
  }
  await expect(methodology.locator('.formula')).toContainText('suite_score = Σ task_score / scored_tasks × 100')

  // Data page lists downloadable artifacts; a sample responds 200.
  await page.goto('/data')
  await expect(page.getByTestId('data-page')).toBeVisible()
  await expect(page.getByTestId('data-table')).toContainText('overview.json')
  await expect(page.getByTestId('data-table')).toContainText('catalog.csv')
  for (const href of ['/data/public/overview.json', '/data/public/runs.json', '/data/public/catalog.csv', '/data/public/inauguration.json']) {
    const response = await page.request.get(href)
    expect(response.status(), `${href} should download`).toBe(200)
  }

  const publicProjection = await page.request.get('/data/public/models.json')
  expect(await publicProjection.text()).not.toMatch(/sacilm/i)

  // About links the public repository.
  await page.goto('/about')
  await expect(page.getByTestId('about-page')).toBeVisible()
  await expect(
    page.getByTestId('about-page').getByRole('link', { name: /github\.com\/domlabsai\/dhevals/ }).first(),
  ).toHaveAttribute('href', 'https://github.com/domlabsai/dhevals')

  // Unknown routes render the designed 404 state.
  await page.goto('/definitely-not-a-page')
  await expect(page.getByTestId('not-found-page')).toBeVisible()

  expect(errors).toEqual([])
})

test('mobile leaderboard uses a details drawer and never overflows horizontally', async ({ page }) => {
  const errors = watchPageErrors(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/leaderboard')
  await expect(page.getByTestId('leaderboard-page')).toBeVisible()

  const table = page.getByTestId('leaderboard-table')
  await expect(table).toContainText('deepseek')
  await expect(table).toContainText('opencode')

  // "Details" opens the drawer with operational metrics; Escape closes it.
  await page.getByRole('button', { name: /Details for/ }).first().click()
  const detailsDrawer = page.getByRole('dialog').last()
  await expect(detailsDrawer).toBeVisible()
  await expect(detailsDrawer).toContainText('Quality /100')
  await expect(detailsDrawer).toContainText('Latency')
  await page.keyboard.press('Escape')
  await expect(detailsDrawer).toBeHidden()

  // The hamburger opens the navigation sheet.
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  const navSheet = page.getByRole('dialog', { name: 'Menu' })
  await expect(navSheet).toBeVisible()
  await expect(navSheet.getByRole('link', { name: 'Benchmarks' })).toBeVisible()
  await page.getByRole('button', { name: 'Close panel' }).click()
  await expect(navSheet).toBeHidden()

  // No horizontal body overflow at 390px.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(391)

  expect(errors).toEqual([])
})

test('keyboard flow: skip link first, visible focus, and ⌘K search', async ({ page }) => {
  const errors = watchPageErrors(page)

  await page.goto('/')
  await expect(page.getByTestId('home-page')).toBeVisible()

  // First Tab from the top of the page reaches the skip link.
  await page.keyboard.press('Tab')
  await expect(page.locator('a.skip-link')).toBeFocused()

  // Focus-visible styling exists on keyboard-focused nav links.
  await page.keyboard.press('Tab') // brand link
  await page.keyboard.press('Tab') // first nav link
  const navLink = page.locator('.topnav__links .topnav__link').first()
  await expect(navLink).toBeFocused()
  const focusStyles = await navLink.evaluate((element) => {
    const styles = getComputedStyle(element)
    return { boxShadow: styles.boxShadow, outlineStyle: styles.outlineStyle }
  })
  expect(focusStyles.boxShadow !== 'none' || focusStyles.outlineStyle !== 'none').toBe(true)

  // ⌘K / Control+K opens the global search dialog; Escape closes it.
  await page.keyboard.press('Control+k')
  const searchDialog = page.getByTestId('global-search')
  await expect(searchDialog).toBeVisible()
  await expect(searchDialog.locator('input')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(searchDialog).toBeHidden()

  // The Search trigger opens the same dialog; Escape restores focus to it.
  const searchTrigger = page.locator('.topnav__search')
  await searchTrigger.click()
  await expect(searchDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(searchDialog).toBeHidden()
  await expect(searchTrigger).toBeFocused()

  expect(errors).toEqual([])
})

test('SEO metadata, JSON-LD, sitemap, and robots', async ({ page }) => {
  const errors = watchPageErrors(page)

  await page.goto('/')
  await expect(page.getByTestId('home-page')).toBeVisible()

  const description = await page.locator('meta[name="description"]').getAttribute('content')
  expect(description?.length).toBeGreaterThan(20)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://dhevals.ai/')
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(ogImage).toContain('/brand/social/')
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')

  // A detail page emits JSON-LD structured data.
  await page.goto('/benchmarks/heavy-user-ptbr-v0-2-0')
  await expect(page.getByTestId('suite-page')).toBeVisible()
  const jsonLdScript = page.locator('script#dhevals-jsonld[type="application/ld+json"]')
  await expect(jsonLdScript).toHaveCount(1)
  const jsonLd = JSON.parse(await jsonLdScript.textContent())
  const jsonLdBlocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd]
  expect(jsonLdBlocks.length).toBeGreaterThan(0)
  expect(jsonLdBlocks[0]['@context']).toBe('https://schema.org')

  // Sitemap and robots are served with sensible content.
  const sitemap = await page.request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const sitemapText = await sitemap.text()
  expect(sitemapText).toContain('<urlset')
  expect(sitemapText).toContain('https://dhevals.ai/leaderboard')
  expect(sitemapText).not.toMatch(/sacilm/i)

  const robots = await page.request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toContain('User-agent: *')

  expect(errors).toEqual([])
})
