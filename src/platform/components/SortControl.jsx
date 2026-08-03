/*
 * SortControl — the leaderboard/table ordering select. Options:
 * [{ value, label }]. Lives inside FilterBar but is standalone-usable.
 */
export function SortControl({ label = 'Sort', options, value, onChange, id, ...rest }) {
  return (
    <div className="field" data-testid="sort-control" {...rest}>
      <label className="field__label" htmlFor={id ?? 'sort-control'}>
        {label}
      </label>
      <select
        id={id ?? 'sort-control'}
        className="select"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default SortControl
