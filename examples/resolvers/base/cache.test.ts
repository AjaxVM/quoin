import { ok } from 'quoin'
import {
  getCachedValue,
  setCachedValue,
  markCacheStale,
  removeCachedValue,
  removeAllCachedValues
} from './cache.js'
import { createTestScope } from '../../fixtures.js'
import type { IAppScope } from '../../scope.js'

describe('cache base calls', () => {
  let scope: IAppScope

  beforeEach(() => {
    scope = createTestScope()
  })

  it('are declared with the right kind', () => {
    expect(getCachedValue.info).toEqual({ name: 'getCachedValue', kind: 'base', type: 'resolver' })
    expect(setCachedValue.info).toEqual({ name: 'setCachedValue', kind: 'base', type: 'mutator' })
    expect(markCacheStale.info).toEqual({ name: 'markCacheStale', kind: 'base', type: 'mutator' })
    expect(removeCachedValue.info).toEqual({ name: 'removeCachedValue', kind: 'base', type: 'mutator' })
    expect(removeAllCachedValues.info).toEqual({
      name: 'removeAllCachedValues',
      kind: 'base',
      type: 'mutator'
    })
  })

  describe('getCachedValue', () => {
    it('resolves null when nothing is cached', async () => {
      await expect(
        getCachedValue({ resolverIdentity: 'thing', key: 'a', ttlMs: 1000 }, scope)
      ).resolves.toEqual(ok(null))
    })

    it('resolves a fresh hit as not stale', async () => {
      await setCachedValue({ resolverIdentity: 'thing', key: 'a' }, { value: 1 }, scope)

      const result = await getCachedValue({ resolverIdentity: 'thing', key: 'a', ttlMs: 1000 }, scope)

      expect(result).toEqual(
        ok({
          data: { value: 1 },
          cache: { cached: true, stale: false, date: expect.any(Date) as Date }
        })
      )
    })

    it('resolves a hit past its ttl as stale', async () => {
      await setCachedValue({ resolverIdentity: 'thing', key: 'a' }, 'value', scope)
      const entry = scope.cacheStore.get('thing', 'a', -1)!
      entry.date = new Date(Date.now() - 10_000)

      const result = await getCachedValue({ resolverIdentity: 'thing', key: 'a', ttlMs: 100 }, scope)

      if (!result.success || result.data === null) {
        throw new Error('expected a stale hit')
      }
      expect(result.data.cache.stale).toBe(true)
    })

    it('resolves a hit as stale once explicitly marked, even within ttl', async () => {
      await setCachedValue({ resolverIdentity: 'thing', key: 'a' }, 'value', scope)
      await markCacheStale({ resolverIdentity: 'thing', key: 'a' }, null, scope)

      const result = await getCachedValue({ resolverIdentity: 'thing', key: 'a', ttlMs: 1_000_000 }, scope)

      if (!result.success || result.data === null) {
        throw new Error('expected a stale hit')
      }
      expect(result.data.cache.stale).toBe(true)
    })

    it('falls back to userId -1 when no one is signed in', async () => {
      await setCachedValue({ resolverIdentity: 'thing', key: 'a' }, 'value', scope)

      expect(scope.cacheStore.get('thing', 'a', -1)?.data).toBe('value')
    })
  })

  describe('setCachedValue', () => {
    it('writes fresh, un-stale data into the store', async () => {
      await setCachedValue({ resolverIdentity: 'thing', key: 'a' }, { value: 1 }, scope)

      const entry = scope.cacheStore.get('thing', 'a', -1)
      expect(entry).toMatchObject({ data: { value: 1 }, stale: false })
    })
  })

  describe('markCacheStale', () => {
    it('flips an existing entry stale without touching its data', async () => {
      await setCachedValue({ resolverIdentity: 'thing', key: 'a' }, 'value', scope)

      await markCacheStale({ resolverIdentity: 'thing', key: 'a' }, null, scope)

      expect(scope.cacheStore.get('thing', 'a', -1)).toMatchObject({
        data: 'value',
        stale: true
      })
    })
  })

  describe('removeCachedValue', () => {
    it('removes just the one entry', async () => {
      await setCachedValue({ resolverIdentity: 'thing', key: 'a' }, 'a', scope)
      await setCachedValue({ resolverIdentity: 'thing', key: 'b' }, 'b', scope)

      await removeCachedValue({ resolverIdentity: 'thing', key: 'a' }, null, scope)

      expect(scope.cacheStore.get('thing', 'a', -1)).toBeUndefined()
      expect(scope.cacheStore.get('thing', 'b', -1)?.data).toBe('b')
    })
  })

  describe('removeAllCachedValues', () => {
    it('clears everything for the user when params is null', async () => {
      await setCachedValue({ resolverIdentity: 'thingA', key: 'a' }, 'a', scope)
      await setCachedValue({ resolverIdentity: 'thingB', key: 'b' }, 'b', scope)

      await removeAllCachedValues(null, null, scope)

      expect(scope.cacheStore.get('thingA', 'a', -1)).toBeUndefined()
      expect(scope.cacheStore.get('thingB', 'b', -1)).toBeUndefined()
    })

    it('narrows to one unit when given', async () => {
      await setCachedValue({ resolverIdentity: 'thingA', key: 'a' }, 'a', scope)
      await setCachedValue({ resolverIdentity: 'thingB', key: 'b' }, 'b', scope)

      await removeAllCachedValues({ resolverIdentity: 'thingA' }, null, scope)

      expect(scope.cacheStore.get('thingA', 'a', -1)).toBeUndefined()
      expect(scope.cacheStore.get('thingB', 'b', -1)?.data).toBe('b')
    })
  })
})
