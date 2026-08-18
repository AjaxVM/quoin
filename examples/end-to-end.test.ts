import { ok } from 'quoin'
import { startMockApiServer, type IMockApiServer } from './api/mock-server.js'
import { getUserById } from './resolvers/base/user.js'
import {
  updateUserEmail,
  getUserProfile,
  getUserWithOrdersOptimized
} from './resolvers/composite/user.js'
import { createTestScope, POSTS, assertOk } from './fixtures.js'
import type { IAppScope } from './scope.js'

const ADA = { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' }

describe('end-to-end: one scope through every kind of call', () => {
  let server: IMockApiServer
  let scope: IAppScope

  beforeAll(async () => {
    server = await startMockApiServer(POSTS)
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    scope = createTestScope(server.baseUrl, { userId: 1 }, { metrics: true })
  })

  it('threads one assembled scope through base resolvers, composites, and a mutator', async () => {
    await expect(getUserById({ id: 1 }, scope)).resolves.toEqual(ok(ADA))

    await expect(getUserProfile({ id: 1 }, scope)).resolves.toEqual(
      ok({
        ...ADA,
        posts: [
          { id: 1, userId: 1, title: 'Hello world', body: 'first post' },
          { id: 2, userId: 1, title: 'Second post', body: 'more thoughts' }
        ]
      })
    )

    await expect(getUserWithOrdersOptimized({ id: 1 }, scope)).resolves.toEqual(
      ok({
        ...ADA,
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

    const updated = await updateUserEmail({ id: 1 }, { email: 'ada@newmail.com' }, scope)
    assertOk(updated)
    expect(updated.data).toMatchObject({ email: 'ada@newmail.com' })

    const reread = await getUserById({ id: 1 }, scope)
    assertOk(reread)
    expect(reread.data).toMatchObject({ email: 'ada@newmail.com' })
  })

  it('collects a chain-attributed timing for every call made through that scope', async () => {
    await getUserProfile({ id: 1 }, scope)

    const metrics = scope.$quoin!.metrics!
    expect(metrics.map((metric) => metric.path.join(' > ')).sort()).toEqual([
      'getUserProfile',
      'getUserProfile > getPostsByUserId',
      'getUserProfile > getUserById'
    ])
    expect(metrics.every((metric) => metric.durationMs >= 0)).toBe(true)
  })

  /**
   * The whole point of the result shape, end to end: a failing API surfaces at the call
   * site as data, through two layers of composition, with no try/catch anywhere —
   * here as a degraded success rather than a thrown exception or a bare failure.
   */
  it('propagates an anticipated failure to the call site as data, without a single throw', async () => {
    const broken = createTestScope(`${server.baseUrl}/wrong-prefix`, {
      userId: 1
    })

    const result = await getUserProfile({ id: 1 }, broken)

    assertOk(result)
    expect(result.data.posts).toEqual([])
    expect(result.data.postsError).toMatchObject({ code: 'POSTS_API_UNAVAILABLE' })
  })
})
