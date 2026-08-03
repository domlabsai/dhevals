/*
 * DataTable — generic semantic table. caption is required (accessibility);
 * columns: [{ key, label, numeric, unit, render(row) }]. Null/undefined
 * cell values render "—" — missing data is never shown as zero.
 */
export function DataTable({
  caption,
  columns,
  rows,
  rowKey,
  sticky = false,
  onRowClick,
  rowAriaLabel,
  footnote,
  className = '',
  ...rest
}) {
  const clickable = typeof onRowClick === 'function'
  return (
    <div className={`table-wrap${className ? ` ${className}` : ''}`}>
      <table
        className={`table${sticky ? ' table--sticky' : ''}`}
        data-testid="data-table"
        {...rest}
      >
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-numeric={column.numeric || undefined}>
                {column.label}
                {column.unit ? <span className="table__unit"> {column.unit}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = rowKey ? rowKey(row) : index
            const interactiveProps = clickable
              ? {
                  'data-clickable': 'true',
                  tabIndex: 0,
                  role: 'link',
                  'aria-label': rowAriaLabel ? rowAriaLabel(row) : undefined,
                  onClick: () => onRowClick(row),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onRowClick(row)
                    }
                  },
                }
              : {}
            return (
              <tr key={key} {...interactiveProps}>
                {columns.map((column) => {
                  const rendered = column.render ? column.render(row) : row[column.key]
                  const missing = rendered === null || rendered === undefined || rendered === ''
                  return (
                    <td key={column.key} data-numeric={column.numeric || undefined}>
                      {missing ? '—' : rendered}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {footnote ? <p className="table__footnote micro faint">{footnote}</p> : null}
    </div>
  )
}

export default DataTable
