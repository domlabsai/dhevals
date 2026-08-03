import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const versionDirectory = process.env.DHEVALS_CALIBRATION_VERSION || 'v0.3'
const packageVersion = versionDirectory === 'v0.2' ? 'v02' : 'v03'
const base = `benchmarks/calibration/heavy-user-ptbr/${versionDirectory}`
const packDirectory = process.env.DHEVALS_CALIBRATION_BLIND_DIR || `reports/calibration/heavy-user-ptbr-${versionDirectory}-blind`
const packPath = process.env.DHEVALS_CALIBRATION_PACK || `${packDirectory}/pack.json`
const outputPath = resolve(root, process.env.DHEVALS_CALIBRATION_HANDOFF_OUTPUT || `reports/calibration/heavy-user-ptbr-${versionDirectory}-handoff.json`)
const publicOutput = resolve(root, process.env.DHEVALS_CALIBRATION_HANDOFF_PUBLIC_OUTPUT || `public/data/calibration/${versionDirectory}/handoff.json`)
const sheetNames = ['reviewer-a.csv', 'reviewer-b.csv']

const pack = readJson(packPath)
const sheets = sheetNames.map((name) => inspectSheet(`${packDirectory}/${name}`, name))
const requiredGroups = Number(pack?.required_groups || 0)
const validPack = pack?.kind === 'dhevals_calibration_pack'
  && pack.suite_id === 'dhevals-heavy-user-ptbr'
  && pack.suite_version === `${versionDirectory.replace(/^v/, '')}.0`
  && requiredGroups > 0
  && sheets.every((sheet) => sheet.exists && sheet.rows === requiredGroups && sheet.columns_valid)
const totalScored = sheets.reduce((total, sheet) => total + sheet.scored_rows, 0)
const allScored = validPack && sheets.every((sheet) => sheet.scored_rows === requiredGroups)
const status = !validPack ? 'blocked' : allScored ? 'ready_to_import' : totalScored ? 'in_progress' : 'ready_for_review'

const artifact = {
  kind: 'dhevals_calibration_handoff',
  schema_version: '0.1.0',
  status,
  suite: {
    id: pack?.suite_id ?? 'dhevals-heavy-user-ptbr',
    version: pack?.suite_version ?? `${versionDirectory.replace(/^v/, '')}.0`,
    rubric_sha256: pack?.rubric_sha256 ?? null,
    examples_sha256: pack?.examples_sha256 ?? null,
    pack_id: pack?.pack_id ?? null,
    anchor_fingerprint: pack?.anchor_fingerprint ?? null,
  },
  review_policy: {
    reviewers_required: 2,
    required_groups: requiredGroups,
    score_scale: pack?.score_scale ?? { min: 0, max: 4, step: 1 },
    adjudication: 'required_on_disagreement',
    notes_are_optional: true,
    public_scores: false,
  },
  reviewers: sheets,
  handoff: {
    workspace: 'Calibration → Open reviewer workspace',
    browser_draft_storage: 'localStorage only; not a public source of truth',
    export_filename: 'reviewer-a.csv or reviewer-b.csv',
    import_command: `npm run import:calibration:${packageVersion}`,
    adjudication_command: `export DHEVALS_CALIBRATION_ADJUDICATIONS=reports/calibration/heavy-user-ptbr-${versionDirectory}-adjudication.csv && npm run import:calibration:${packageVersion}`,
    progress_artifact: `public/data/calibration/${versionDirectory}/progress.json`,
    completion_gate: 'two complete reviewer sheets, adjudication for disagreements, then frozen rubric',
  },
  sources: {
    pack: relative(root, resolve(root, packPath)),
    rubric: `${base}/anchor-rubric.json`,
    examples: `${base}/anchor-examples.json`,
    review_data: `public/data/calibration/${versionDirectory}/review-data.json`,
  },
  safety: { secrets_recorded: false, reviewer_scores_fabricated: false },
  generated_at: new Date().toISOString(),
}

mkdirSync(resolve(outputPath, '..'), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
if (publicOutput !== outputPath) {
  mkdirSync(resolve(publicOutput, '..'), { recursive: true })
  writeFileSync(publicOutput, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
}

console.log(JSON.stringify({
  output: relative(root, outputPath),
  public_output: relative(root, publicOutput),
  status,
  suite_version: artifact.suite.version,
  required_groups: requiredGroups,
  reviewers: sheets.map((sheet) => ({ id: sheet.reviewer_id, rows: sheet.rows, scored: sheet.scored_rows, sha256: sheet.sha256 })),
}, null, 2))

function inspectSheet(relativePath, reviewerId) {
  const path = resolve(root, relativePath)
  if (!existsSync(path)) return { reviewer_id: reviewerId.replace('.csv', ''), file: relativePath, exists: false, rows: 0, scored_rows: 0, columns_valid: false, sha256: null }
  const bytes = readFileSync(path)
  const rows = parseCsv(bytes.toString('utf8'))
  const header = rows[0] || []
  const expectedHeader = ['task_id', 'dimension_id', 'dimension_guidance', 'anchor_level', 'example_output', 'example_target', 'score', 'notes']
  const scoredRows = rows.slice(1).filter((row) => /^[0-4]$/.test(String(row[6] || '').trim()))
  return {
    reviewer_id: reviewerId.replace('.csv', ''),
    file: relativePath,
    exists: true,
    rows: Math.max(0, rows.length - 1),
    scored_rows: scoredRows.length,
    unscored_rows: Math.max(0, rows.length - 1 - scoredRows.length),
    columns_valid: header.length === expectedHeader.length && header.every((field, index) => field === expectedHeader[index]),
    sha256: createHash('sha256').update(bytes).digest('hex'),
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

function readJson(relativePath) {
  const path = resolve(root, relativePath)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}
