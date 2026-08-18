import { jest } from '@jest/globals'
import type { DatabaseSync } from 'node:sqlite'
import { ok } from 'quoin'
import { startMockApiServer, type IMockApiServer } from '../../api/mock-server.js'
import {
  updateUserEmail,
  getUserWithOrders,
  getUserWithOrdersOptimized,
  getUserProfile,
  getCurrentUserOrders
} from './user.js'
import { getUserById } from '../base/user.js'
import {
  createTestScope,
  SEEDED_USER_IDS,
  POSTS,
  UNUSED_API,
  assertOk,
  assertFail
} from '../../fixtures.js'
import type { IAppScope } from '../../scope.js'

/**
 * Writes land, but the row is gone by the time anything reads it back — something
 * else removed it in between. setUserEmail goes through `run`, getUserById through
 * `get`, so only the read needs replacing.
 */
function withVanishingReads(db: DatabaseSync): DatabaseSync {
  return {
    prepare: (sql: string) => {
      // Delegated one by one rather than spread: StatementSync keeps its methods
      // on the prototype, so a spread copies none of them.
      const statement = db.prepare(sql)
      return {
        run: (...params: unknown[]) => statement.run(...(params as never[])),
        all: (...params: unknown[]) => statement.all(...(params as never[])),
        get: () => undefined
      }
    }
  } as unknown as DatabaseSync
}

describe('composite user calls', () => {
  it('are all declared composite', () => {
    expect(updateUserEmail.info.kind).toBe('composite')
    expect(getUserWithOrders.info.kind).toBe('composite')
    expect(getUserWithOrdersOptimized.info.kind).toBe('composite')
    expect(getUserProfile.info.kind).toBe('composite')
    expect(getCurrentUserOrders.info.kind).toBe('composite')
  })

  it('never trip the composition guard', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const scope = createTestScope()

    try {
      await getUserWithOrders({ id: 1 }, scope)
      await getUserWithOrdersOptimized({ id: 1 }, scope)
      await updateUserEmail({ id: 1 }, { email: 'ada@newmail.com' }, scope)

      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})

/**
 * Reads the session's own userId directly — no DB round trip needed just to
 * confirm what the scope already knows.
 */
describe('getCurrentUserOrders', () => {
  it('uses the session user’s id to fetch their orders', async () => {
    const scope = createTestScope(UNUSED_API, { userId: 2 }, { metrics: true })

    await expect(getCurrentUserOrders(null, scope)).resolves.toEqual(
      ok([
        {
          id: 3,
          userId: 2,
          item: 'Analytical Engine notes',
          amountCents: 9900
        }
      ])
    )
    expect(scope.$quoin!.metrics!.map((metric) => metric.name)).toEqual([
      'getOrdersByUserId',
      'getCurrentUserOrders'
    ])
  })

  it('fails when nobody is signed in, without reaching the orders query', async () => {
    const scope = createTestScope(UNUSED_API, { userId: null }, { metrics: true })

    const result = await getCurrentUserOrders(null, scope)

    assertFail(result)
    expect(result.error).toEqual({
      code: 'NOT_AUTHENTICATED',
      message: 'No signed-in user'
    })
    expect(scope.$quoin!.metrics!.map((metric) => metric.name)).toEqual(['getCurrentUserOrders'])
  })
})

describe('updateUserEmail', () => {
  let scope: IAppScope

  beforeEach(() => {
    scope = createTestScope()
  })

  it('writes through the base mutator and reads back through the base resolver', async () => {
    await expect(updateUserEmail({ id: 1 }, { email: 'ada@newmail.com' }, scope)).resolves.toEqual(
      ok({ id: 1, name: 'Ada Lovelace', email: 'ada@newmail.com' })
    )

    const reread = await getUserById({ id: 1 }, scope)
    assertOk(reread)
    expect(reread.data).toMatchObject({ email: 'ada@newmail.com' })
  })

  /**
   * The non-atomic case: the write lands, the read back doesn't. Driven entirely
   * through the scope — the composite imports getUserById directly, so there is
   * nothing to substitute, but there doesn't need to be. Everything that resolver
   * does comes from scope.db.
   */
  it('reports what already applied when the read back fails after a successful write', async () => {
    const scope = createTestScope()
    scope.db = withVanishingReads(scope.db)

    const result = await updateUserEmail({ id: 1 }, { email: 'ada@newmail.com' }, scope)

    assertFail(result)
    expect(result.error).toMatchObject({
      code: 'USER_READ_BACK_FAILED',
      // Present only because setUserEmail succeeded — this is what proves the
      // write leg ran rather than failing first.
      applied: ['setUserEmail'],
      cause: { code: 'USER_NOT_FOUND' }
    })
  })

  /**
   * The write failed, so nothing landed. No `applied` — and a caller is entitled to
   * read its absence as "nothing happened".
   */
  it('fails on the write with nothing applied, before attempting the read', async () => {
    const measured = createTestScope(UNUSED_API, { userId: null }, { metrics: true })

    const result = await updateUserEmail({ id: 999 }, { email: 'nobody@example.com' }, measured)

    assertFail(result)
    expect(result.error).toMatchObject({ code: 'USER_NOT_FOUND' })
    expect(result.error?.applied).toBeUndefined()
    expect(measured.$quoin!.metrics!.map((metric) => metric.name)).toEqual([
      'setUserEmail',
      'updateUserEmail'
    ])
  })
})

/**
 * The optimized variant only earns its place if it is indistinguishable from
 * composing the base resolvers. Asserted against every seeded user rather than a
 * couple of hand-picked cases, so a fixture added later widens the check for free.
 */
describe('getUserWithOrders vs getUserWithOrdersOptimized', () => {
  let scope: IAppScope

  beforeEach(() => {
    scope = createTestScope()
  })

  it.each(SEEDED_USER_IDS)('return identical results for user %i', async (id) => {
    const [plain, optimized] = await Promise.all([
      getUserWithOrders({ id }, scope),
      getUserWithOrdersOptimized({ id }, scope)
    ])

    expect(optimized).toEqual(plain)
  })

  it('returns the user with their orders', async () => {
    await expect(getUserWithOrders({ id: 1 }, scope)).resolves.toEqual(
      ok({
        id: 1,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        orders: [
          {
            id: 1,
            userId: 1,
            item: 'Difference Engine plans',
            amountCents: 5000
          },
          { id: 2, userId: 1, item: 'Punch cards', amountCents: 1200 }
        ]
      })
    )
  })

  /** Equivalence has to cover how they fail, not just what they return. */
  it('fail identically for a missing user — error included, not just "it failed"', async () => {
    const [plain, optimized] = await Promise.all([
      getUserWithOrders({ id: 999 }, scope),
      getUserWithOrdersOptimized({ id: 999 }, scope)
    ])

    expect(optimized).toEqual(plain)
    assertFail(plain)
    expect(plain.error).toEqual({
      code: 'USER_NOT_FOUND',
      message: 'User 999 not found'
    })
  })

  it('costs fewer resolver calls than the plain composite', async () => {
    const measured = createTestScope(UNUSED_API, { userId: null }, { metrics: true })

    await getUserWithOrders({ id: 1 }, measured)
    await getUserWithOrdersOptimized({ id: 1 }, measured)

    expect(measured.$quoin!.metrics!.map((metric) => metric.path.join(' > '))).toEqual([
      'getUserWithOrders > getUserById',
      'getUserWithOrders > getOrdersByUserId',
      'getUserWithOrders',
      'getUserWithOrdersOptimized'
    ])
  })
})

describe('getUserProfile (cross-source composite)', () => {
  let server: IMockApiServer

  beforeAll(async () => {
    server = await startMockApiServer(POSTS)
  })

  afterAll(async () => {
    await server.close()
  })

  it('merges the DB user with their posts from the API', async () => {
    await expect(getUserProfile({ id: 1 }, createTestScope(server.baseUrl))).resolves.toEqual(
      ok({
        id: 1,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        posts: [
          { id: 1, userId: 1, title: 'Hello world', body: 'first post' },
          { id: 2, userId: 1, title: 'Second post', body: 'more thoughts' }
        ]
      })
    )
  })

  it('reaches both sources off the one scope', async () => {
    const scope = createTestScope(server.baseUrl, { userId: null }, { metrics: true })

    await getUserProfile({ id: 1 }, scope)

    expect(scope.$quoin!.metrics!.map((metric) => metric.name).sort()).toEqual([
      'getPostsByUserId',
      'getUserById',
      'getUserProfile'
    ])
  })

  // The user is the part a profile can't do without — no degrading around that.
  it('fails when the DB side fails', async () => {
    const result = await getUserProfile({ id: 999 }, createTestScope(server.baseUrl))

    assertFail(result)
    expect(result.error).toMatchObject({ code: 'USER_NOT_FOUND' })
    expect(result.error?.applied).toBeUndefined()
  })

  /**
   * The degrade-gracefully case: the user succeeded, so the profile still comes
   * back ok — with empty posts and the API's own error code preserved in
   * `postsError`, so a caller can tell "no posts" from "couldn't ask".
   */
  it('succeeds with empty posts and a postsError when the API side fails', async () => {
    const scope = createTestScope(`${server.baseUrl}/wrong-prefix`)

    const result = await getUserProfile({ id: 1 }, scope)

    assertOk(result)
    expect(result.data.posts).toEqual([])
    expect(result.data.postsError).toMatchObject({ code: 'POSTS_API_UNAVAILABLE' })
  })
})
