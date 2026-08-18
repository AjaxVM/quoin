import { jest } from '@jest/globals'
import { ok, fail } from 'quoin'
import { cachedApiFetch, CACHE_RESOLVER_IDENTITY } from './cache.js'
import { setCachedValue, markCacheStale } from '../base/cache.js'
import { createTestScope, assertOk, assertFail } from '../../fixtures.js'
import type { IAppScope } from '../../scope.js'
import type { IPostsApiClient } from '../../api/client.js'

/** Swaps in a stand-in apiClient so tests control the live fetch without a server. */
function withApiClient(scope: IAppScope, getByPath: IPostsApiClient['getByPath']): IAppScope {
  return {
    ...scope,
    apiClient: {
      getPostsByUserId: () => {
        throw new Error('not used by these tests')
      },
      getByPath
    }
  }
}

describe('cachedApiFetch', () => {
  let scope: IAppScope

  beforeEach(() => {
    scope = createTestScope()
  })

  it('is declared composite', () => {
    expect(cachedApiFetch.info).toEqual({ name: 'cachedApiFetch', kind: 'composite', type: 'resolver' })
  })

  it('never trips the composition guard', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    await cachedApiFetch({ path: '/thing', ttlMs: 1000 }, withApiClient(scope, () =>
      Promise.resolve(ok('value'))
    ))

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('fetches live on a miss and caches the result', async () => {
    const getByPath = jest.fn(() => Promise.resolve(ok('fresh')))
    const result = await cachedApiFetch({ path: '/thing', ttlMs: 1000 }, withApiClient(scope, getByPath))

    assertOk(result)
    expect(result.data).toEqual({
      data: 'fresh',
      cache: { cached: false, stale: false, date: expect.any(Date) as Date }
    })
    expect(getByPath).toHaveBeenCalledTimes(1)
  })

  it('returns a fresh cache hit without fetching', async () => {
    await setCachedValue({ resolverIdentity: CACHE_RESOLVER_IDENTITY, key: '/thing' }, 'cached', scope)
    const getByPath = jest.fn(() => Promise.resolve(ok('fresh')))

    const result = await cachedApiFetch({ path: '/thing', ttlMs: 1000 }, withApiClient(scope, getByPath))

    assertOk(result)
    expect(result.data).toMatchObject({ data: 'cached', cache: { cached: true, stale: false } })
    expect(getByPath).not.toHaveBeenCalled()
  })

  it('refetches a stale hit and returns the fresh value', async () => {
    await setCachedValue({ resolverIdentity: CACHE_RESOLVER_IDENTITY, key: '/thing' }, 'stale', scope)
    await markCacheStale({ resolverIdentity: CACHE_RESOLVER_IDENTITY, key: '/thing' }, null, scope)
    const getByPath = jest.fn(() => Promise.resolve(ok('fresh')))

    const result = await cachedApiFetch({ path: '/thing', ttlMs: 1000 }, withApiClient(scope, getByPath))

    assertOk(result)
    expect(result.data).toMatchObject({ data: 'fresh', cache: { cached: false } })
    expect(getByPath).toHaveBeenCalledTimes(1)
  })

  it('falls back to the stale value when the refetch fails', async () => {
    await setCachedValue({ resolverIdentity: CACHE_RESOLVER_IDENTITY, key: '/thing' }, 'stale', scope)
    await markCacheStale({ resolverIdentity: CACHE_RESOLVER_IDENTITY, key: '/thing' }, null, scope)
    const getByPath = jest.fn(() =>
      Promise.resolve(fail({ code: 'API_UNAVAILABLE', message: 'down' }))
    )

    const result = await cachedApiFetch({ path: '/thing', ttlMs: 1000 }, withApiClient(scope, getByPath))

    assertOk(result)
    expect(result.data).toMatchObject({ data: 'stale', cache: { cached: true, stale: true } })
  })

  it('cacheOnly returns a stale value immediately, without attempting a fetch', async () => {
    await setCachedValue({ resolverIdentity: CACHE_RESOLVER_IDENTITY, key: '/thing' }, 'stale', scope)
    await markCacheStale({ resolverIdentity: CACHE_RESOLVER_IDENTITY, key: '/thing' }, null, scope)
    const getByPath = jest.fn(() => Promise.resolve(ok('fresh')))

    const result = await cachedApiFetch(
      { path: '/thing', ttlMs: 1000, cacheOnly: true },
      withApiClient(scope, getByPath)
    )

    assertOk(result)
    expect(result.data).toMatchObject({ data: 'stale', cache: { stale: true } })
    expect(getByPath).not.toHaveBeenCalled()
  })

  it('cacheOnly returns null on a miss too, without attempting a fetch', async () => {
    const getByPath = jest.fn(() => Promise.resolve(ok('fresh')))

    const result = await cachedApiFetch(
      { path: '/thing', ttlMs: 1000, cacheOnly: true },
      withApiClient(scope, getByPath)
    )

    assertOk(result)
    expect(result.data).toBeNull()
    expect(getByPath).not.toHaveBeenCalled()
  })

  it('force always fetches live, even with a fresh cache entry', async () => {
    await setCachedValue({ resolverIdentity: CACHE_RESOLVER_IDENTITY, key: '/thing' }, 'cached', scope)
    const getByPath = jest.fn(() => Promise.resolve(ok('fresh')))

    const result = await cachedApiFetch(
      { path: '/thing', ttlMs: 1000, force: true },
      withApiClient(scope, getByPath)
    )

    assertOk(result)
    expect(result.data).toMatchObject({ data: 'fresh', cache: { cached: false } })
    expect(getByPath).toHaveBeenCalledTimes(1)
  })

  it('propagates the failure when nothing is cached and the fetch fails', async () => {
    const error = { code: 'API_UNAVAILABLE', message: 'down' }
    const getByPath = jest.fn(() => Promise.resolve(fail(error)))

    const result = await cachedApiFetch({ path: '/thing', ttlMs: 1000 }, withApiClient(scope, getByPath))

    assertFail(result)
    expect(result.error).toEqual(error)
  })

  it('propagates the failure when force fetches and that fetch fails', async () => {
    await setCachedValue({ resolverIdentity: CACHE_RESOLVER_IDENTITY, key: '/thing' }, 'cached', scope)
    const error = { code: 'API_UNAVAILABLE', message: 'down' }
    const getByPath = jest.fn(() => Promise.resolve(fail(error)))

    const result = await cachedApiFetch(
      { path: '/thing', ttlMs: 1000, force: true },
      withApiClient(scope, getByPath)
    )

    assertFail(result)
    expect(result.error).toEqual(error)
  })
})
