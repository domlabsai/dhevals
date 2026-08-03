import { useMemo, useRef, useState } from 'react'
import { useProjection, formatDate, RUN_STATUS } from '../data.js'
import { navigate } from '../router.jsx'
import { Dialog } from './Dialog.jsx'
import { EvidenceBadge } from './EvidenceBadge.jsx'
import { Icon } from './icons.jsx'

const MAX_PER_GROUP = 5

function buildIndex(data) {
  if (!data) return { models: [], suites: [], runs: [] }
  return {
    models: data.models.map((model) => ({
      key: `model-${model.id}`,
      title: model.name,
      to: `/models/${model.slug}`,
      haystack: `${model.name} ${model.id} ${model.provider}`.toLowerCase(),
      state: model.evidence_status,
      date: model.last_activity_at ?? model.last_verified_at,
    })),
    suites: data.suites.map((suite) => ({
      key: `suite-${suite.slug}`,
      title: `${suite.title} · v${suite.version}`,
      to: `/benchmarks/${suite.slug}`,
      haystack: `${suite.title} ${suite.slug} ${suite.version}`.toLowerCase(),
      state: suite.status === 'fixture_only' ? 'locked' : 'pending',
      date: suite.last_reviewed_at,
    })),
    runs: data.runs.entries.map((run) => ({
      key: `run-${run.id}`,
      title: `${run.model_name} · ${run.id}`,
      to: `/reports/${run.id}`,
      haystack: `${run.id} ${run.model_name} ${run.suite_id}`.toLowerCase(),
      status: RUN_STATUS[run.run_status]?.label ?? run.run_status,
      date: run.completed_at ?? run.started_at,
    })),
  }
}

/*
 * GlobalSearch — ⌘K dialog filtering models, suites and reports from the
 * public projection. Grouped listbox with full keyboard navigation.
 */
export function GlobalSearch({ open, onClose }) {
  const { status, data } = useProjection()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)

  const index = useMemo(() => buildIndex(status === 'ready' ? data : null), [status, data])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (item) => !q || item.haystack.includes(q)
    return [
      { label: 'Models', items: index.models.filter(match).slice(0, MAX_PER_GROUP) },
      { label: 'Suites', items: index.suites.filter(match).slice(0, MAX_PER_GROUP) },
      { label: 'Reports', items: index.runs.filter(match).slice(0, MAX_PER_GROUP) },
    ].filter((group) => group.items.length > 0)
  }, [index, query])

  const flat = groups.flatMap((group) => group.items)
  const clampedActive = Math.min(activeIndex, Math.max(0, flat.length - 1))

  const close = () => {
    setQuery('')
    setActiveIndex(0)
    onClose()
  }

  const pick = (item) => {
    close()
    navigate(item.to)
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && flat[clampedActive]) {
      event.preventDefault()
      pick(flat[clampedActive])
    }
  }

  let optionIndex = -1

  return (
    <Dialog open={open} onClose={close} data-testid="global-search" aria-label="Search">
      <div className="search__input-row">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="text"
          className="search__input"
          placeholder="Search models, suites, reports…"
          value={query}
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          aria-activedescendant={flat[clampedActive] ? `search-option-${flat[clampedActive].key}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={onKeyDown}
          data-autofocus
        />
      </div>
      <div className="search__results" role="listbox" id="search-results" aria-label="Search results">
        {flat.length === 0 ? (
          <p className="search__empty">No matches — try a model, suite, or run id.</p>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <p className="search__group-label">{group.label}</p>
              {group.items.map((item) => {
                optionIndex += 1
                const thisIndex = optionIndex
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="option"
                    id={`search-option-${item.key}`}
                    aria-selected={thisIndex === clampedActive}
                    className="search__option"
                    onClick={() => pick(item)}
                    onMouseEnter={() => setActiveIndex(thisIndex)}
                  >
                    <span className="search__option-title">{item.title}</span>
                    {item.state ? <EvidenceBadge state={item.state} /> : null}
                    {item.status ? <span className="badge">{item.status}</span> : null}
                    <span className="search__option-meta">{formatDate(item.date)}</span>
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
    </Dialog>
  )
}

export default GlobalSearch
