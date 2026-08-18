import { useEffect, useState, type ReactElement } from 'react'
import { useResolver } from 'quoin/react'
import { getUserProfileWithOrders, type IUserProfileWithOrders } from '../resolvers/composite/user.js'
import type { TAppResult } from '../../quoin.js'

/**
 * Same hook, same shape as examples/react/user-profile.tsx — what's different is
 * what's on the other side of useResolver: a fetch against the app's own server
 * (examples/server.ts) instead of a direct DB connection. QuoinProvider doesn't
 * know or care which.
 */
export function RemoteUserProfile({ userId }: { userId: number }): ReactElement {
  const getProfile = useResolver(getUserProfileWithOrders)
  const [result, setResult] = useState<TAppResult<IUserProfileWithOrders> | null>(null)

  useEffect(() => {
    let cancelled = false
    setResult(null)
    void getProfile({ id: userId }).then((next) => {
      if (!cancelled) {
        setResult(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [getProfile, userId])

  if (result === null) {
    return <p>Loading…</p>
  }
  if (!result.success) {
    return <p role="alert">{result.error?.message ?? 'Something went wrong'}</p>
  }
  return (
    <div>
      <dl>
        <dt>Name</dt>
        <dd>{result.data.name}</dd>
        <dt>Email</dt>
        <dd>{result.data.email}</dd>
      </dl>
      <ul aria-label="posts">
        {result.data.posts.map((post) => <li key={post.id}>{post.title}</li>)}
      </ul>
      <ul aria-label="orders">
        {result.data.orders.map((order) => <li key={order.id}>{order.item}</li>)}
      </ul>
    </div>
  )
}
