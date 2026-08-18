import { compositeResolver, ok } from 'quoin'
import type { IAppScope } from '../../scope.js'
import type { TAppResult } from '../../quoin.js'
import {
  getCachedValue,
  setCachedValue,
  resolverIdentity,
  type ICachedValue,
  type ICacheTarget
} from '../base/cache.js'

/**
 * `path` is this call's identity — which thing to fetch and cache. Everything else is
 * configuration for how: `ttlMs` is one option among several, not the point of the
 * shape — a real deployment might add others here (which API version to hit, say).
 */
export interface ICachedApiFetchParams {
  path: string
  ttlMs: number
  /** Always fetches live and refreshes the cache, ignoring whatever's stored. */
  force?: boolean
  /**
   * Fetches only from the cache, never live: a stale hit still returns as-is, and no
   * hit at all returns `null` rather than fetching.
   */
  cacheOnly?: boolean
}

function freshCachedValue(data: unknown): ICachedValue {
  return { data, cache: { cached: false, stale: false, date: new Date() } }
}

/** Fetches live and writes it back through the cache — callers decide how to treat a failure. */
async function fetchAndCache(
  scope: IAppScope,
  target: ICacheTarget,
  path: string
): Promise<TAppResult<unknown>> {
  const fresh = await scope.apiClient.getByPath(path)
  if (!fresh.success) {
    return fresh
  }

  await setCachedValue(target, fresh.data, scope)
  return fresh
}

/**
 * Ties a cache read/write to a real fetch. `force`/`cacheOnly` trade freshness against
 * latency; everything else falls through the same "prefer cache, degrade to a live
 * fetch" path.
 */
export const cachedApiFetch = compositeResolver(
  'cachedApiFetch',
  async (
    params: ICachedApiFetchParams,
    scope: IAppScope
  ): Promise<TAppResult<ICachedValue | null>> => {
    const target: ICacheTarget = {
      resolverIdentity: CACHE_RESOLVER_IDENTITY,
      key: params.path
    }

    if (params.force) {
      const fresh = await fetchAndCache(scope, target, params.path)
      // Forcing means the caller explicitly doesn't want a stale answer, so a
      // failed refresh propagates rather than quietly falling back to the cache.
      return fresh.success ? ok(freshCachedValue(fresh.data)) : fresh
    }

    const cached = await getCachedValue({ ...target, ttlMs: params.ttlMs }, scope)
    if (!cached.success) {
      return cached
    }

    if (cached.data !== null) {
      if (!cached.data.cache.stale || params.cacheOnly) {
        return ok(cached.data)
      }

      const fresh = await fetchAndCache(scope, target, params.path)
      return fresh.success ? ok(freshCachedValue(fresh.data)) : ok(cached.data)
    }

    if (params.cacheOnly) {
      return ok(null)
    }

    const fresh = await fetchAndCache(scope, target, params.path)
    return fresh.success ? ok(freshCachedValue(fresh.data)) : fresh
  }
)

/**
 * Derived rather than hand-typed, so a rename can't silently split the cache bucket
 * in two. Exported so tests can pre-seed the cache under the exact value the
 * composite itself uses. Safe to reference `cachedApiFetch.info` here — this line
 * only runs once, after the `const` above has already been assigned; the body that
 * closes over `CACHE_RESOLVER_IDENTITY` doesn't run until a caller invokes it later.
 */
export const CACHE_RESOLVER_IDENTITY = resolverIdentity(cachedApiFetch.info)
