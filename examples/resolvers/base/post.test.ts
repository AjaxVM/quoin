import { ok } from 'quoin'
import { startMockApiServer, type IMockApiServer } from '../../api/mock-server.js'
import { getPostsByUserId } from './post.js'
import { createTestScope, POSTS, assertFail } from '../../fixtures.js'
import type { IAppScope } from '../../scope.js'

describe('base post resolvers (HTTP-backed)', () => {
  let server: IMockApiServer
  let scope: IAppScope

  beforeAll(async () => {
    server = await startMockApiServer(POSTS)
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    scope = createTestScope(server.baseUrl)
  })

  it('is declared base — an HTTP source is still one source', () => {
    expect(getPostsByUserId.info).toEqual({
      name: 'getPostsByUserId',
      kind: 'base',
      type: 'resolver'
    })
  })

  it('resolves posts for that user over the mock HTTP server', async () => {
    await expect(getPostsByUserId({ userId: 1 }, scope)).resolves.toEqual(
      ok([
        { id: 1, userId: 1, title: 'Hello world', body: 'first post' },
        { id: 2, userId: 1, title: 'Second post', body: 'more thoughts' }
      ])
    )
  })

  it('succeeds with an empty array for a user with no posts', async () => {
    await expect(getPostsByUserId({ userId: 999 }, scope)).resolves.toEqual(ok([]))
  })

  /**
   * The API being down is the interface saying "not right now" — it arrives as a
   * failure the caller can branch on, with no try/catch anywhere in the chain.
   */
  it('relays an API failure as a failure result, not a throw', async () => {
    const broken = createTestScope(`${server.baseUrl}/wrong-prefix`)

    const result = await getPostsByUserId({ userId: 1 }, broken)

    assertFail(result)
    expect(result.error).toMatchObject({
      code: 'POSTS_API_UNAVAILABLE',
      retryable: false
    })
  })
})
