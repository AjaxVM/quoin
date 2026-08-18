/**
 * A per-user, in-memory cache. `resolverIdentity` namespaces entries by whatever's
 * producing them, `key` identifies one call within that namespace — the same split
 * `db/` and `api/` don't need, because this is the only source shared across
 * otherwise-unrelated resolvers.
 */
export interface ICacheEntry<TData = unknown> {
  resolverIdentity: string
  key: string
  userId: number
  data: TData
  date: Date
  stale: boolean
}

export interface ICacheStore {
  get: (resolverIdentity: string, key: string, userId: number) => ICacheEntry | undefined
  /** Stamps `date` to now and clears `stale` — a write is always fresh. */
  set: (resolverIdentity: string, key: string, userId: number, data: unknown) => ICacheEntry
  markStale: (resolverIdentity: string, key: string, userId: number) => void
  remove: (resolverIdentity: string, key: string, userId: number) => void
  /** `resolverIdentity` omitted clears everything for that user. */
  removeAll: (userId: number, resolverIdentity?: string) => void
}

function mapKey(resolverIdentity: string, key: string, userId: number): string {
  return `${userId}\0${resolverIdentity}\0${key}`
}

export function createCacheStore(): ICacheStore {
  const entries = new Map<string, ICacheEntry>()

  return {
    get: (resolverIdentity, key, userId) => entries.get(mapKey(resolverIdentity, key, userId)),

    set: (resolverIdentity, key, userId, data) => {
      const entry: ICacheEntry = {
        resolverIdentity,
        key,
        userId,
        data,
        date: new Date(),
        stale: false
      }
      entries.set(mapKey(resolverIdentity, key, userId), entry)
      return entry
    },

    markStale: (resolverIdentity, key, userId) => {
      const entry = entries.get(mapKey(resolverIdentity, key, userId))
      if (entry) {
        entry.stale = true
      }
    },

    remove: (resolverIdentity, key, userId) => {
      entries.delete(mapKey(resolverIdentity, key, userId))
    },

    removeAll: (userId, resolverIdentity) => {
      for (const [storedKey, entry] of entries) {
        if (
          entry.userId === userId
          && (resolverIdentity === undefined || entry.resolverIdentity === resolverIdentity)
        ) {
          entries.delete(storedKey)
        }
      }
    }
  }
}
