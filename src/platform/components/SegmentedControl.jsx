/*
 * SegmentedControl — radiogroup semantics, one option checked at a time.
 * options: [{ value, label }]
 */
export function SegmentedControl({ options, value, onChange, ariaLabel, name, className = '', ...rest }) {
  return (
    <div
      className={`segmented${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid="segmented-control"
      {...rest}
    >
      {options.map((option) => (
        <label key={option.value} className="segmented__option" aria-checked={option.value === value} role="radio">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange?.(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

export default SegmentedControl
