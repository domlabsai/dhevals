import { Icon } from './icons.jsx'

/*
 * FilterChip — one active filter as a removable pill. Always shows the
 * dimension ("Evidence: Pending") so the applied state is unambiguous.
 */
export function FilterChip({ label, onRemove, ...rest }) {
  return (
    <span className="chip" data-testid="filter-chip" {...rest}>
      <span>{label}</span>
      <button type="button" className="chip__remove" aria-label={`Remove filter ${label}`} onClick={onRemove}>
        <Icon name="x" size={12} />
      </button>
    </span>
  )
}

export default FilterChip
