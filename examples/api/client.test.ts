import { ok } from 'quoin'
import { startMockApiServer, type IMockApiServer } from './mock-server.js'
import { createPostsApiClient } from './client.js'
import { POSTS, assertFail } from '../fixtures.js'
import type { IAppError } from '../quoin.js'

/**
 * The source adapter's own boundary. It returns results rather than throwing,
 * which is what lets the resolver over it be a pure relay — every case below would
 * otherwise be a try/catch in each resolver that touches this API.
 */
describe('posts API client', () => {
  let server: IMockApiServer

  beforeAll(async () => {
    server = await startMockApiServer(POSTS)
  })

  afterAll(async () => {
    await server.close()
  })

  it('returns the posts for a user', async () => {
    await expect(createPostsApiClient(server.baseUrl).getPostsByUserId(1)).resolves.toEqual(
      ok([
        { id: 1, userId: 1, title: 'Hello world', body: 'first post' },
        { id: 2, userId: 1, title: 'Second post', body: 'more thoughts' }
      ])
    )
  })

  it('fails on a non-2xx response, marking a 4xx as not worth retrying', async () => {
    const result = await createPostsApiClient(`${server.baseUrl}/wrong-prefix`).getPostsByUserId(1)

    assertFail(result)
    expect(result.error).toEqual({
      code: 'POSTS_API_UNAVAILABLE',
      message: 'Posts API request failed with status 404',
      retryable: false
    })
  })

  it('marks a 5xx as retryable', async () => {
    await expect(errorFrom('', 503)).resolves.toMatchObject({
      code: 'POSTS_API_UNAVAILABLE',
      retryable: true
    })
  })

  it('fails when the payload is not an array', async () => {
    await expect(errorFrom('{"posts":[]}')).resolves.toEqual({
      code: 'POSTS_API_MALFORMED',
      message: 'Posts API did not return an array'
    })
  })

  it('fails when a post is missing a field the app relies on', async () => {
    const payload = JSON.stringify([{ id: 1, userId: 1, title: 'No body' }])

    await expect(errorFrom(payload)).resolves.toMatchObject({
      code: 'POSTS_API_MALFORMED',
      message: 'posts[0] is missing a string title/body'
    })
  })

  it('fails when an array entry is not an object at all', async () => {
    await expect(errorFrom('["nope"]')).resolves.toMatchObject({
      message: 'posts[0] is not an object'
    })
  })

  it('fails when an id is not numeric', async () => {
    const payload = JSON.stringify([{ id: '1', userId: 1 }])

    await expect(errorFrom(payload)).resolves.toMatchObject({
      message: 'posts[0] is missing a numeric id/userId'
    })
  })

  it('getByPath returns whatever the endpoint sends back, unvalidated', async () => {
    await expect(
      createPostsApiClient(server.baseUrl).getByPath('/users/1/posts')
    ).resolves.toEqual(
      ok([
        { id: 1, userId: 1, title: 'Hello world', body: 'first post' },
        { id: 2, userId: 1, title: 'Second post', body: 'more thoughts' }
      ])
    )
  })

  it('getByPath fails the same way as getPostsByUserId on a non-2xx response', async () => {
    const result = await createPostsApiClient(server.baseUrl).getByPath('/nowhere')

    assertFail(result)
    expect(result.error).toEqual({
      code: 'API_UNAVAILABLE',
      message: 'Request to /nowhere failed with status 404',
      retryable: false
    })
  })
})

/** Serves `body` to the client and returns the error it reports back. */
async function errorFrom(body: string, status = 200): Promise<IAppError | undefined> {
  const client = createPostsApiClient('http://example.invalid')
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(body, { status })

  try {
    const result = await client.getPostsByUserId(1)
    assertFail(result)
    return result.error
  } finally {
    globalThis.fetch = original
  }
}
