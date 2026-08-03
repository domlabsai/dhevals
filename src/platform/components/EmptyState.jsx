import { Button } from './Button.jsx'

/*
 * EmptyState — designed "nothing here yet" block. Empty ranked data is a
 * real state of this product, not an error.
 */
export function EmptyState({ title, body, action, ...rest }) {
  return (
    <div className="state-block" data-testid="empty-state" {...rest}>
      <p className="state-block__title">{title}</p>
      {body ? <p className="state-block__body">{body}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  )
}

/*
 * ErrorState — data failed to load; retry re-triggers the loader.
 */
export function ErrorState({ title = 'Data failed to load', body, onRetry, ...rest }) {
  return (
    <div className="state-block state-block--error" role="alert" data-testid="error-state" {...rest}>
      <p className="state-block__title">{title}</p>
      {body ? <p className="state-block__body">{body}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export default EmptyState
