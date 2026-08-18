import { getUserProfile } from './user.js'
import { startAppServer, type IAppServer } from '../../../server.js'
import { startMockApiServer, type IMockApiServer } from '../../../api/mock-server.js'
import { createTestScope, POSTS, assertOk, assertFail } from '../../../fixtures.js'
import { createClientScope } from '../../scope.js'

describe('client getUserProfile', () => {
  let postsServer: IMockApiServer
  let appServer: IAppServer

  beforeAll(async () => {
    postsServer = await startMockApiServer(POSTS)
    appServer = await startAppServer(createTestScope(postsServer.baseUrl))
  })

  afterAll(async () => {
    await appServer.close()
    await postsServer.close()
  })

  it('is declared base — one HTTP source, even though the server composed it', () => {
    expect(getUserProfile.info.kind).toBe('base')
  })

  it('fetches the same shape getUserProfile returns server-side', async () => {
    const result = await getUserProfile({ id: 1 }, createClientScope(appServer.baseUrl))

    assertOk(result)
    expect(result.data).toEqual({
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      posts: [
        { id: 1, userId: 1, title: 'Hello world', body: 'first post' },
        { id: 2, userId: 1, title: 'Second post', body: 'more thoughts' }
      ]
    })
  })

  it('fails with the server\'s own error code when the route 404s', async () => {
    const scope = createClientScope(`${appServer.baseUrl}/wrong-prefix`)

    const result = await getUserProfile({ id: 1 }, scope)

    assertFail(result)
    expect(result.error?.code).toBe('ROUTE_NOT_FOUND')
  })

  it('fails with the server\'s own error code when the resolver itself fails', async () => {
    const result = await getUserProfile({ id: 999 }, createClientScope(appServer.baseUrl))

    assertFail(result)
    expect(result.error?.code).toBe('USER_NOT_FOUND')
  })
})
