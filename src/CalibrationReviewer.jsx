import { useEffect, useMemo, useState } from 'react'

const SCORE_LABELS = {
  0: 'Fail',
  1: 'Weak',
  2: 'Acceptable',
  3: 'Strong',
  4: 'Excellent',
}

const BLIND_FIELDS = [
  'task_id',
  'dimension_id',
  'dimension_guidance',
  'anchor_level',
  'example_output',
  'example_target',
  'score',
  'notes',
]

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function downloadText(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function storageKey(payload, reviewerId) {
  return `dhevals-calibration:${payload?.suite_id ?? 'suite'}:${payload?.suite_version ?? 'version'}:${reviewerId}`
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
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field')
  if (row.length > 0 || cell !== '') {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function validateReviewRows(rows, payload, reviewerId, filename) {
  if (filename !== `${reviewerId}.csv`) throw new Error(`file must be named ${reviewerId}.csv for this pack`)
  if (!rows.length || rows[0].length !== BLIND_FIELDS.length || rows[0].some((field, index) => field !== BLIND_FIELDS[index])) {
    throw new Error(`CSV header must be exactly ${BLIND_FIELDS.join(',')}`)
  }
  const groups = payload.groups ?? []
  if (rows.length - 1 !== groups.length) throw new Error(`CSV has ${rows.length - 1} rows; pack requires ${groups.length}`)
  const imported = {}
  groups.forEach((group, index) => {
    const row = rows[index + 1]
    if (row.length !== BLIND_FIELDS.length) throw new Error(`CSV row ${index + 2} has ${row.length} columns`)
    const expected = [group.task_id, group.dimension_id, group.dimension_guidance, String(group.anchor_level), group.example_output, group.example_target]
    expected.forEach((value, fieldIndex) => {
      if (row[fieldIndex] !== value) throw new Error(`CSV row ${index + 2} does not match the blinded anchor pack`)
    })
    const scoreText = String(row[6] ?? '').trim()
    if (scoreText && !/^[0-4]$/.test(scoreText)) throw new Error(`CSV row ${index + 2} has an invalid score`)
    imported[group.group_id] = {}
    if (scoreText) imported[group.group_id].score = Number(scoreText)
    if (String(row[7] ?? '').trim()) imported[group.group_id].notes = row[7]
  })
  return imported
}

export default function CalibrationReviewer({ onClose }) {
  const [version, setVersion] = useState('0.3')
  const [reviewerId, setReviewerId] = useState('reviewer-a')
  const [payload, setPayload] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [taskFilter, setTaskFilter] = useState('all')
  const [dimensionFilter, setDimensionFilter] = useState('all')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [drafts, setDrafts] = useState({})
  const [notes, setNotes] = useState('')
  const [csvStatus, setCsvStatus] = useState({ kind: 'idle', message: 'No CSV validated in this session.' })

  useEffect(() => {
    let cancelled = false
    setPayload(null)
    setLoadError('')
    fetch(`/data/calibration/v${version}/review-data.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`review data returned ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (!cancelled) setPayload(data)
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message || 'Unable to load review data')
      })
    return () => { cancelled = true }
  }, [version])

  useEffect(() => {
    setCurrentIndex(0)
    if (!payload) {
      setDrafts({})
      return
    }
    try {
      const stored = window.localStorage.getItem(storageKey(payload, reviewerId))
      const parsed = stored ? JSON.parse(stored) : {}
      setDrafts(parsed && typeof parsed === 'object' ? parsed : {})
    } catch {
      setDrafts({})
    }
  }, [payload, reviewerId])

  useEffect(() => {
    setCsvStatus({ kind: 'idle', message: 'No CSV validated in this session.' })
  }, [payload, reviewerId])

  useEffect(() => {
    if (!payload) return
    try {
      window.localStorage.setItem(storageKey(payload, reviewerId), JSON.stringify(drafts))
    } catch {
      // A private browsing context may reject localStorage. Export remains available.
    }
  }, [drafts, payload, reviewerId])

  const tasks = payload?.tasks ?? []
  const dimensions = payload?.dimensions ?? []
  const groups = payload?.groups ?? []
  const filteredGroups = useMemo(() => groups.filter((group) => (
    (taskFilter === 'all' || group.task_id === taskFilter)
    && (dimensionFilter === 'all' || group.dimension_id === dimensionFilter)
  )), [groups, taskFilter, dimensionFilter])
  const currentGroup = filteredGroups[currentIndex] ?? filteredGroups[0] ?? null
  const scoredCount = groups.reduce((count, group) => (Number.isInteger(drafts[group.group_id]?.score) ? count + 1 : count), 0)
  const currentResponse = currentGroup ? drafts[currentGroup.group_id] ?? {} : {}

  useEffect(() => {
    setNotes(currentResponse.notes ?? '')
  }, [currentGroup?.group_id])

  useEffect(() => {
    if (currentIndex >= filteredGroups.length && filteredGroups.length) setCurrentIndex(filteredGroups.length - 1)
  }, [currentIndex, filteredGroups.length])

  const updateDraft = (groupId, update) => {
    setDrafts((previous) => ({
      ...previous,
      [groupId]: { ...(previous[groupId] ?? {}), ...update },
    }))
  }

  const selectGroup = (index) => {
    setCurrentIndex(index)
    setNotes(drafts[filteredGroups[index]?.group_id]?.notes ?? '')
  }

  const scoreCurrent = (score) => {
    if (!currentGroup) return
    updateDraft(currentGroup.group_id, { score })
  }

  const saveNotes = () => {
    if (!currentGroup) return
    updateDraft(currentGroup.group_id, { notes })
  }

  const nextUnscored = () => {
    if (!filteredGroups.length) return
    const start = (currentIndex + 1) % filteredGroups.length
    const ordered = [...filteredGroups.slice(start), ...filteredGroups.slice(0, start)]
    const next = ordered.find((group) => !Number.isInteger(drafts[group.group_id]?.score))
    const target = next ?? ordered[0]
    const index = filteredGroups.findIndex((group) => group.group_id === target.group_id)
    selectGroup(index === -1 ? 0 : index)
  }

  const exportCsv = () => {
    if (!payload) return
    const rows = [BLIND_FIELDS, ...groups.map((group) => {
      const response = drafts[group.group_id] ?? {}
      return [
        group.task_id,
        group.dimension_id,
        group.dimension_guidance,
        group.anchor_level,
        group.example_output,
        group.example_target,
        Number.isInteger(response.score) ? response.score : '',
        response.notes ?? '',
      ]
    })]
    // Keep the pack's canonical basename so the exported file can be handed
    // directly to `import-blind --pack` after copying it into the blind pack.
    downloadText(`${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, `${reviewerId}.csv`, 'text/csv;charset=utf-8')
  }

  const exportJson = () => {
    if (!payload) return
    downloadText(JSON.stringify({
      kind: 'dhevals_calibration_review_draft',
      schema_version: '0.1.0',
      suite_id: payload.suite_id,
      suite_version: payload.suite_version,
      reviewer_id: reviewerId,
      pack_id: payload.pack?.pack_id ?? null,
      responses: drafts,
    }, null, 2), `${payload.suite_id}-${version}-${reviewerId}-review.json`, 'application/json;charset=utf-8')
  }

  const clearDraft = () => {
    setDrafts({})
    setNotes('')
    if (!payload) return
    try { window.localStorage.removeItem(storageKey(payload, reviewerId)) } catch { /* best effort */ }
  }

  const importCsv = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !payload) return
    try {
      const imported = validateReviewRows(parseCsv(await file.text()), payload, reviewerId, file.name)
      setDrafts(imported)
      setCurrentIndex(0)
      setNotes(imported[groups[0]?.group_id]?.notes ?? '')
      const scored = Object.values(imported).filter((response) => Number.isInteger(response.score)).length
      setCsvStatus({ kind: 'ready', message: `Validated ${file.name} · ${groups.length} rows · ${scored} scored` })
    } catch (error) {
      setCsvStatus({ kind: 'error', message: error.message || 'CSV validation failed' })
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="calibration-reviewer" data-testid="calibration-reviewer">
      <div className="reviewer-header">
        <div>
          <span className="inspector-label">Calibration lab · local-only draft</span>
          <h3>Anchor review workspace</h3>
          <p>Score every response against the blinded anchor. Notes stay in this browser until you export the worksheet.</p>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>Exit reviewer workspace</button>
      </div>

      <div className="reviewer-controls">
        <label className="reviewer-control">Suite version
          <select value={version} onChange={(event) => setVersion(event.target.value)}>
            <option value="0.3">v0.3 · 300 groups</option>
            <option value="0.2">v0.2 · 150 groups</option>
          </select>
        </label>
        <label className="reviewer-control">Reviewer
          <select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
            <option value="reviewer-a">Reviewer A</option>
            <option value="reviewer-b">Reviewer B</option>
          </select>
        </label>
        <label className="reviewer-control">Task filter
          <select value={taskFilter} onChange={(event) => { setTaskFilter(event.target.value); setCurrentIndex(0) }}>
            <option value="all">All tasks</option>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
        </label>
        <label className="reviewer-control">Dimension filter
          <select value={dimensionFilter} onChange={(event) => { setDimensionFilter(event.target.value); setCurrentIndex(0) }}>
            <option value="all">All dimensions</option>
            {dimensions.map((dimension) => <option key={dimension.id} value={dimension.id}>{dimension.label}</option>)}
          </select>
        </label>
        <div className="reviewer-progress" data-testid="review-progress">
          <span>Progress</span>
          <strong>{scoredCount} / {groups.length}</strong>
          <small>{groups.length ? `${Math.round((scoredCount / groups.length) * 100)}% scored` : 'loading'}</small>
        </div>
      </div>

      {loadError && <div className="reviewer-error" role="alert">{loadError}</div>}
      {!payload && !loadError && <div className="reviewer-loading">Loading review anchors…</div>}
      {payload && <>
        <div className="reviewer-layout">
          <aside className="reviewer-queue" aria-label="Review queue">
            <div className="reviewer-queue-head"><span className="inspector-label">Queue</span><span>{filteredGroups.length} anchors</span></div>
            <div className="reviewer-queue-list">
              {filteredGroups.map((group, index) => {
                const response = drafts[group.group_id]
                return <button key={group.group_id} className={`reviewer-queue-button ${index === currentIndex ? 'active' : ''}`} type="button" onClick={() => selectGroup(index)}>
                  <span className="reviewer-queue-index">{index + 1}</span>
                  <span><strong>{group.task_title}</strong><small>{group.dimension_label} · anchor {group.anchor_level}</small></span>
                  <em>{Number.isInteger(response?.score) ? response.score : '—'}</em>
                </button>
              })}
            </div>
          </aside>

          <article className="reviewer-card">
            {currentGroup ? <>
              <div className="reviewer-card-head">
                <div><span className="inspector-label">{currentGroup.task_id} · {currentGroup.category}</span><h4>{currentGroup.task_title}</h4></div>
                <span className="reviewer-anchor-badge">Anchor {currentGroup.anchor_level}</span>
              </div>
              <div className="reviewer-dimension"><span className="inspector-label">Dimension · {currentGroup.dimension_label}</span><p>{currentGroup.dimension_guidance}</p></div>
              <div className="reviewer-example-grid">
                <div className="reviewer-example"><span className="inspector-label">Example output</span><pre>{currentGroup.example_output}</pre></div>
                <div className="reviewer-example"><span className="inspector-label">Anchor target</span><pre>{currentGroup.example_target}</pre></div>
              </div>
              <div className="reviewer-score-section">
                <div className="reviewer-score-head"><span className="inspector-label">Your score</span><span>0 = fail · 4 = excellent</span></div>
                <div className="reviewer-score-palette" role="radiogroup" aria-label="Anchor score">
                  {[0, 1, 2, 3, 4].map((score) => <button key={score} className={`reviewer-score-button ${currentResponse.score === score ? 'selected' : ''}`} type="button" data-testid={`score-${score}`} aria-pressed={currentResponse.score === score} onClick={() => scoreCurrent(score)}><strong>{score}</strong><span>{SCORE_LABELS[score]}</span></button>)}
                </div>
              </div>
              <label className="reviewer-notes"><span className="inspector-label">Notes for adjudication</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={saveNotes} placeholder="Record the reason for this score, uncertainty or an edge case…" rows="4" /></label>
              <div className="reviewer-actions"><button className="ghost-button" type="button" onClick={() => { saveNotes(); nextUnscored() }}>Next unscored</button><button className="ghost-button" type="button" onClick={clearDraft}>Clear local draft</button><button className="ghost-button" type="button" onClick={exportJson}>Export JSON draft</button><button className="director-button" type="button" onClick={() => { saveNotes(); exportCsv() }}>Export blind CSV</button><label className="reviewer-import-button"><span>Validate CSV</span><input data-testid="review-csv-input" type="file" accept=".csv,text/csv" onChange={importCsv} /></label></div>
              <div className={`reviewer-csv-status ${csvStatus.kind}`} data-testid="csv-validation" role={csvStatus.kind === 'error' ? 'alert' : undefined}>{csvStatus.message}</div>
            </> : <div className="reviewer-loading">No anchors match these filters.</div>}
          </article>
        </div>
        <div className="reviewer-footer"><span>Pack {payload.pack?.pack_id ?? 'not generated'} · {payload.source?.pack ?? 'pack pending'}</span><span>Local draft only — import the exported CSV with <code>dhevals-calibration-sheet import-blind</code>.</span></div>
      </>}
    </div>
  )
}
