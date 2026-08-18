import { createCacheStore } from './store.js'

describe('cache store', () => {
  it('has nothing for a key that was never set', () => {
    const store = createCacheStore()

    expect(store.get('unit', 'key', 1)).toBeUndefined()
  })

  it('returns what was set, fresh and not stale', () => {
    const store = createCacheStore()

    const entry = store.set('unit', 'key', 1, { value: 'thing' })

    expect(entry.stale).toBe(false)
    expect(store.get('unit', 'key', 1)).toEqual(entry)
  })

  it('keeps different users apart under the same unit/key', () => {
    const store = createCacheStore()

    store.set('unit', 'key', 1, 'for user 1')
    store.set('unit', 'key', 2, 'for user 2')

    expect(store.get('unit', 'key', 1)?.data).toBe('for user 1')
    expect(store.get('unit', 'key', 2)?.data).toBe('for user 2')
  })

  it('marks an entry stale without touching its data', () => {
    const store = createCacheStore()
    store.set('unit', 'key', 1, 'value')

    store.markStale('unit', 'key', 1)

    const entry = store.get('unit', 'key', 1)
    expect(entry?.stale).toBe(true)
    expect(entry?.data).toBe('value')
  })

  it('does nothing when marking a missing entry stale', () => {
    const store = createCacheStore()

    expect(() => store.markStale('unit', 'key', 1)).not.toThrow()
  })

  it('removes one entry, leaving others untouched', () => {
    const store = createCacheStore()
    store.set('unit', 'a', 1, 'a')
    store.set('unit', 'b', 1, 'b')

    store.remove('unit', 'a', 1)

    expect(store.get('unit', 'a', 1)).toBeUndefined()
    expect(store.get('unit', 'b', 1)?.data).toBe('b')
  })

  it('removeAll clears every entry for a user when no unit is given', () => {
    const store = createCacheStore()
    store.set('unitA', 'key', 1, 'a')
    store.set('unitB', 'key', 1, 'b')
    store.set('unitA', 'key', 2, 'other user')

    store.removeAll(1)

    expect(store.get('unitA', 'key', 1)).toBeUndefined()
    expect(store.get('unitB', 'key', 1)).toBeUndefined()
    expect(store.get('unitA', 'key', 2)?.data).toBe('other user')
  })

  it('removeAll narrows to one unit when given', () => {
    const store = createCacheStore()
    store.set('unitA', 'key', 1, 'a')
    store.set('unitB', 'key', 1, 'b')

    store.removeAll(1, 'unitA')

    expect(store.get('unitA', 'key', 1)).toBeUndefined()
    expect(store.get('unitB', 'key', 1)?.data).toBe('b')
  })
})
