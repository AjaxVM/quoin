import { useEffect, useState, type ReactElement } from 'react'
import { useResolver } from 'quoin/react'
import { getUserById } from '../resolvers/base/user.js'
import type { IUser } from '../db/connection.js'
import type { TAppResult } from '../quoin.js'

/**
 * useResolver stays a thin bind — loading/error/data is this component's own
 * state, not something the hook manages. Caching is a composite-resolver
 * concern (see examples/resolvers/composite/cache.ts), not a hook one.
 */
export function UserProfile({ userId }: { userId: number }): ReactElement {
  const getUser = useResolver(getUserById)
  const [result, setResult] = useState<TAppResult<IUser> | null>(null)

  useEffect(() => {
    let cancelled = false
    setResult(null)
    void getUser({ id: userId }).then((next) => {
      if (!cancelled) {
        setResult(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [getUser, userId])

  if (result === null) {
    return <p>Loading…</p>
  }
  if (!result.success) {
    return <p role="alert">{result.error?.message ?? 'Something went wrong'}</p>
  }
  return (
    <dl>
      <dt>Name</dt>
      <dd>{result.data.name}</dd>
      <dt>Email</dt>
      <dd>{result.data.email}</dd>
    </dl>
  )
}
