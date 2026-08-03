import { reloadProjection, formatDateTime } from '../data.js'
import { Skeleton } from '../components/Skeleton.jsx'
import { ErrorState } from '../components/ErrorState.jsx'
import { Icon } from '../components/icons.jsx'

/*
 * Shared page scaffolding: loading skeleton, error-with-retry, and the
 * amber stale banner shown when the projection is older than 24h.
 */

export function PageLoading({ testid, height = 240 }) {
  return (
    <div className="container section" data-testid={testid}>
      <div className="stack stack--6">
        <Skeleton lines={2} width="42%" />
        <Skeleton variant="block" height={height} />
        <Skeleton lines={3} />
      </div>
    </div>
  )
}

export function PageError({ testid, error }) {
  return (
    <div className="container section" data-testid={testid}>
      <ErrorState
        body={error?.message}
        onRetry={() => {
          reloadProjection()
          window.location.reload()
        }}
      />
    </div>
  )
}

export function StaleBanner({ generatedAt }) {
  return (
    <p className="notice notice--amber" role="status">
      <Icon name="clock" />
      <span>
        This projection was generated {formatDateTime(generatedAt)} and is older than 24 hours —
        figures may lag the evidence store.
      </span>
    </p>
  )
}
