import { useState } from 'react'
import { Button } from './Button.jsx'
import { DataTable } from './DataTable.jsx'
import { formatScore } from '../data.js'

/*
 * ComparisonHeatmap — category × two-model delta grid. Cells carry a text
 * label ALWAYS (tint alone never communicates state):
 *   positive verified → lime tint, negative → cobalt tint,
 *   estimated → amber hatch, missing → flat + "—".
 * A "View data table" toggle renders the same numbers as a plain table.
 *
 * Props:
 *   models    [{ name }, { name }] (A, B — delta is A minus B)
 *   rows      [{ category, a: number|null, b: number|null, state }]
 *             state: 'verified' | 'estimated' | 'missing'
 */
export function ComparisonHeatmap({ models, rows = [], caption, className = '', ...rest }) {
  const [showTable, setShowTable] = useState(false)
  const [a, b] = models

  const deltaFor = (row) => {
    if (row.state !== 'verified') return null
    if (typeof row.a !== 'number' || typeof row.b !== 'number') return null
    return row.a - row.b
  }

  const cellState = (row) => {
    const delta = deltaFor(row)
    if (delta === null) return row.state === 'estimated' ? 'estimated' : 'missing'
    if (delta > 0) return 'pos'
    if (delta < 0) return 'neg'
    return 'flat'
  }

  const deltaLabel = (row) => {
    const delta = deltaFor(row)
    if (delta === null) return '—'
    const glyph = delta > 0 ? '▲' : delta < 0 ? '▼' : '='
    return `${glyph} ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`
  }

  return (
    <section className={`heatmap${className ? ` ${className}` : ''}`} data-testid="comparison-heatmap" {...rest}>
      <div className="heatmap__head">
        <p className="label muted">{caption}</p>
        <Button variant="quiet" size="sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'View heatmap' : 'View data table'}
        </Button>
      </div>
      {showTable ? (
        <DataTable
          caption={caption}
          columns={[
            { key: 'category', label: 'Category' },
            { key: 'a', label: a.name, numeric: true, render: (row) => (typeof row.a === 'number' ? formatScore(row.a) : null) },
            { key: 'b', label: b.name, numeric: true, render: (row) => (typeof row.b === 'number' ? formatScore(row.b) : null) },
            { key: 'delta', label: `Δ (${a.name} − ${b.name})`, numeric: true, render: (row) => deltaLabel(row) },
          ]}
          rows={rows}
          rowKey={(row) => row.category}
        />
      ) : (
        <div className="table-wrap">
          <table className="table heatmap__grid">
            <caption>{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" data-numeric>{a.name}</th>
                <th scope="col" data-numeric>{b.name}</th>
                <th scope="col" data-numeric>Δ A − B</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = cellState(row)
                return (
                  <tr key={row.category}>
                    <th scope="row">{row.category}</th>
                    <td data-numeric>{typeof row.a === 'number' ? formatScore(row.a) : '—'}</td>
                    <td data-numeric>{typeof row.b === 'number' ? formatScore(row.b) : '—'}</td>
                    <td data-numeric className={`heatmap__cell heatmap__cell--${state}`}>
                      {deltaLabel(row)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ul className="heatmap__legend micro" aria-label="Legend">
        <li><span className="heatmap__swatch heatmap__cell--pos" aria-hidden="true" /> Positive verified delta (A leads)</li>
        <li><span className="heatmap__swatch heatmap__cell--neg" aria-hidden="true" /> Negative verified delta (B leads)</li>
        <li><span className="heatmap__swatch heatmap__cell--estimated" aria-hidden="true" /> Estimated — treat as approximate</li>
        <li><span className="heatmap__swatch heatmap__cell--missing" aria-hidden="true" /> Missing — not comparable</li>
      </ul>
    </section>
  )
}

export default ComparisonHeatmap
