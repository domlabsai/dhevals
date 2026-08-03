import { useEffect, useState } from 'react'

/*
 * Public data layer. The platform reads a static, pre-built projection from
 * /data/public/*.json — no live inference, no API server. Results are cached
 * at module level so client-side route changes never refetch.
 */

const PROJECTION_FILES = ['overview', 'models', 'suites', 'runs', 'leaderboard']
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export async function fetchJson(url) {
  let response
  try {
    response = await fetch(url)
  } catch (cause) {
    throw new Error(`Network error while loading ${url}`, { cause })
  }
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (HTTP ${response.status})`)
  }
  try {
    return await response.json()
  } catch (cause) {
    throw new Error(`Invalid JSON at ${url}`, { cause })
  }
}

/* Module-level projection cache (promise-based so concurrent mounts share it) */
let projectionPromise = null

function loadProjection() {
  if (!projectionPromise) {
    projectionPromise = Promise.all(
      PROJECTION_FILES.map((name) => fetchJson(`/data/public/${name}.json`)),
    ).then(([overview, models, suites, runs, leaderboard]) => ({
      overview,
      models,
      suites,
      runs,
      leaderboard,
    }))
  }
  return projectionPromise
}

/* Allows ErrorState retry buttons to refetch after a failure. */
export function reloadProjection() {
  projectionPromise = null
  return loadProjection()
}

export function useProjection() {
  const [state, setState] = useState(() => ({ status: 'loading', data: null, error: null }))

  useEffect(() => {
    let cancelled = false
    loadProjection()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null })
      })
      .catch((error) => {
        projectionPromise = null // allow a later retry
        if (!cancelled) setState({ status: 'error', data: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status !== 'ready') return state

  const generatedAt = state.data.overview?.generated_at ?? null
  const stale = generatedAt
    ? Date.now() - Date.parse(generatedAt) > STALE_AFTER_MS
    : false
  return { ...state, generatedAt, stale }
}

let inaugurationPromise = null

function loadInauguration() {
  if (!inaugurationPromise) inaugurationPromise = fetchJson('/data/public/inauguration.json')
  return inaugurationPromise
}

export function useInauguration() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  useEffect(() => {
    let cancelled = false
    loadInauguration()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null })
      })
      .catch((error) => {
        inaugurationPromise = null
        if (!cancelled) setState({ status: 'error', data: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/* Lazy per-run detail cache: runId -> Promise<detail> */
const runDetailCache = new Map()

function loadRunDetail(runId) {
  if (!runDetailCache.has(runId)) {
    runDetailCache.set(runId, fetchJson(`/data/public/runs/${runId}.json`))
  }
  return runDetailCache.get(runId)
}

export function useRunDetail(runId) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  useEffect(() => {
    if (!runId) {
      setState({ status: 'error', data: null, error: new Error('Missing run id') })
      return undefined
    }
    let cancelled = false
    setState({ status: 'loading', data: null, error: null })
    loadRunDetail(runId)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null })
      })
      .catch((error) => {
        runDetailCache.delete(runId) // allow a later retry
        if (!cancelled) setState({ status: 'error', data: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [runId])

  return state
}

/* ---------- Formatting helpers (data honesty: missing is "—", never 0) ---------- */

export function formatScore(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(1)
}

export function formatDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${formatDate(iso)}, ${date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
  })}`
}

export function formatMs(ms) {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function formatTokens(tokens) {
  if (typeof tokens !== 'number' || Number.isNaN(tokens)) return '—'
  return tokens.toLocaleString('en-US')
}

export function slugForModel(model) {
  return model?.slug ?? model?.id ?? null
}

/* ---------- Evidence + run status vocabularies ---------- */

export const EVIDENCE_STATES = {
  supported: {
    label: 'Supported',
    color: 'lime',
    description: 'Backed by a promoted, fully verified run.',
  },
  estimated: {
    label: 'Estimated',
    color: 'amber',
    description: 'Derived from partial or indirect evidence; treat as approximate.',
  },
  pending: {
    label: 'Pending',
    color: 'amber',
    description: 'Evaluation or calibration still in progress; no public score yet.',
  },
  locked: {
    label: 'Locked',
    color: 'amber',
    description: 'Evidence exists but is gated (fixture, archive-only, or pre-release).',
  },
  invalid: {
    label: 'Invalid',
    color: 'red',
    description: 'Failed verification; must not be read as a result.',
  },
}

export const RUN_STATUS = {
  promoted: { label: 'Promoted', color: 'lime' },
  verified: { label: 'Verified', color: 'cyan' },
  archive_only: { label: 'Archive only', color: 'amber' },
  locked: { label: 'Locked', color: 'amber' },
  invalid: { label: 'Invalid', color: 'red' },
}
