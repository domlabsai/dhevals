import { useId, useRef } from 'react'

/*
 * Tabs — WAI-ARIA tablist with arrow-key navigation.
 * tabs: [{ id, label, content }]
 */
export function Tabs({ tabs, value, onChange, ariaLabel, className = '', ...rest }) {
  const baseId = useId()
  const listRef = useRef(null)
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === value))
  const active = tabs[activeIndex]

  const move = (delta) => {
    const next = (activeIndex + delta + tabs.length) % tabs.length
    onChange?.(tabs[next].id)
    listRef.current
      ?.querySelectorAll('[role="tab"]')
      ?.[next]?.focus()
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      move(-1)
    }
  }

  return (
    <div className={`tabs${className ? ` ${className}` : ''}`} data-testid="tabs" {...rest}>
      <div className="tabs__list" role="tablist" aria-label={ariaLabel} ref={listRef} onKeyDown={onKeyDown}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={tab.id === active.id}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={tab.id === active.id ? 0 : -1}
            className="tabs__tab"
            onClick={() => onChange?.(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          className="tabs__panel"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  )
}

export default Tabs
