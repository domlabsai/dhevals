import { useId } from 'react'

/*
 * Select — styled native select with a visible label.
 * options: [{ value, label }] or strings.
 */
export function Select({ label, options = [], value, onChange, id, className = '', ...rest }) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className={`field${className ? ` ${className}` : ''}`} data-testid="select-field">
      <label className="field__label" htmlFor={selectId}>
        {label}
      </label>
      <select id={selectId} className="select" value={value} onChange={(event) => onChange?.(event.target.value)} {...rest}>
        {options.map((option) => {
          const opt = typeof option === 'string' ? { value: option, label: option } : option
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          )
        })}
      </select>
    </div>
  )
}

export default Select
