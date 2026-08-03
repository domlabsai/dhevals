import { Button } from './Button.jsx'
import { FilterChip } from './FilterChip.jsx'
import { SortControl } from './SortControl.jsx'

/*
 * FilterBar — search input + dropdown filters + sort + active-filter chips.
 * Presentational: the page owns the (URL-backed) state and passes chips in
 * already resolved to human labels.
 *
 * Props:
 *   search   { value, onChange, placeholder, label }
 *   selects  [{ key, label, value, options: [{value,label}], onChange }]
 *   sort     { value, options, onChange }
 *   chips    [{ key, label, onRemove }]
 *   onReset  reset all filters (only rendered when chips exist)
 */
export function FilterBar({
  search,
  selects = [],
  sort,
  chips = [],
  onReset,
  resultCount,
  ariaLabel = 'Filters',
  ...rest
}) {
  return (
    <section className="filterbar" aria-label={ariaLabel} data-testid="filter-bar" {...rest}>
      <div className="filterbar__controls">
        {search ? (
          <div className="field filterbar__search">
            <label className="field__label" htmlFor="filterbar-search">
              {search.label ?? 'Search'}
            </label>
            <input
              id="filterbar-search"
              className="input"
              type="search"
              value={search.value}
              placeholder={search.placeholder}
              onChange={(event) => search.onChange?.(event.target.value)}
            />
          </div>
        ) : null}
        {selects.map((select) => (
          <div className="field" key={select.key}>
            <label className="field__label" htmlFor={`filterbar-${select.key}`}>
              {select.label}
            </label>
            <select
              id={`filterbar-${select.key}`}
              className="select"
              value={select.value}
              onChange={(event) => select.onChange?.(event.target.value)}
            >
              {select.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {sort ? <SortControl value={sort.value} options={sort.options} onChange={sort.onChange} /> : null}
        {chips.length > 0 && onReset ? (
          <Button variant="quiet" size="sm" onClick={onReset} className="filterbar__reset">
            Reset filters
          </Button>
        ) : null}
      </div>
      {chips.length > 0 ? (
        <div className="filterbar__chips" aria-live="polite">
          <span className="micro faint">
            {chips.length} active filter{chips.length === 1 ? '' : 's'}
            {typeof resultCount === 'number'
              ? ` · ${resultCount} result${resultCount === 1 ? '' : 's'}`
              : ''}
          </span>
          {chips.map((chip) => (
            <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default FilterBar
