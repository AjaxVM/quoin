import { resolver, mutator, ok, type IInfo } from 'quoin'
import type { IAppScope } from '../../scope.js'
import type { TAppResult } from '../../quoin.js'

/** Non-user-bounded calls (nothing signed in) cache under this rather than nothing. */
export function cacheUserId(scope: IAppScope): number {
  return scope.session.userId ?? -1
}

/** Derives a cache bucket name from a resolver's own info, rather than a hand-typed string. */
export function resolverIdentity(info: IInfo): string {
  return `quoin::${info.kind}::${info.name}`
}

/** `resolverIdentity` + `key` together are this call's identity — which entry to touch. */
export interface ICacheTarget {
  /** Namespaces entries so unrelated caches never collide on the same key. */
  resolverIdentity: string
  key: string
}

export interface ICachedValue<TData = unknown> {
  data: TData
  cache: {
    /** False for a value that just came from a live fetch, not the store. */
    cached: boolean
    stale: boolean
    date: Date
  }
}

/**
 * `null` means nothing cached at all — different from a stale hit, which still
 * hands back the data alongside `stale: true` so a caller can decide to use it.
 * `ttlMs` is this call's one configuration option, alongside the `ICacheTarget`
 * identity — how long a cached entry stays fresh before it's reported stale.
 */
export const getCachedValue = resolver(
  'getCachedValue',
  async (
    params: ICacheTarget & { ttlMs: number },
    scope: IAppScope
  ): Promise<TAppResult<ICachedValue | null>> => {
    const entry = scope.cacheStore.get(
      params.resolverIdentity,
      params.key,
      cacheUserId(scope)
    )
    if (!entry) {
      return ok(null)
    }

    const expired = Date.now() - entry.date.getTime() > params.ttlMs
    return ok({
      data: entry.data,
      cache: { cached: true, stale: entry.stale || expired, date: entry.date }
    })
  }
)

/** Writes are always fresh — this stamps `date` to now and clears `stale`. */
export const setCachedValue = mutator(
  'setCachedValue',
  async (params: ICacheTarget, value: unknown, scope: IAppScope): Promise<TAppResult> => {
    scope.cacheStore.set(params.resolverIdentity, params.key, cacheUserId(scope), value)
    return ok()
  }
)

/** For "something changed, invalidate this" call sites — the data stays, the flag flips. */
export const markCacheStale = mutator(
  'markCacheStale',
  async (params: ICacheTarget, _value: null, scope: IAppScope): Promise<TAppResult> => {
    scope.cacheStore.markStale(params.resolverIdentity, params.key, cacheUserId(scope))
    return ok()
  }
)

export const removeCachedValue = mutator(
  'removeCachedValue',
  async (params: ICacheTarget, _value: null, scope: IAppScope): Promise<TAppResult> => {
    scope.cacheStore.remove(params.resolverIdentity, params.key, cacheUserId(scope))
    return ok()
  }
)

/**
 * `null` params clears everything for the calling user; `{ resolverIdentity }`
 * narrows to one bucket.
 */
export const removeAllCachedValues = mutator(
  'removeAllCachedValues',
  async (
    params: { resolverIdentity?: string } | null,
    _value: null,
    scope: IAppScope
  ): Promise<TAppResult> => {
    scope.cacheStore.removeAll(cacheUserId(scope), params?.resolverIdentity)
    return ok()
  }
)
