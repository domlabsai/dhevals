import { Metric } from './Metric.jsx'

/*
 * MetricStrip — up to 4 metrics in a hairline-separated row; wraps to a
 * 2-column grid on mobile.
 */
export function MetricStrip({ metrics = [], className = '', ...rest }) {
  return (
    <div className={`metric-strip${className ? ` ${className}` : ''}`} data-testid="metric-strip" {...rest}>
      {metrics.slice(0, 4).map((metric) => (
        <Metric key={metric.label} {...metric} />
      ))}
    </div>
  )
}

export default MetricStrip
