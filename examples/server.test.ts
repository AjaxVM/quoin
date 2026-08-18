import { startAppServer, type IAppServer } from './server.js'
import { startMockApiServer, type IMockApiServer } from './api/mock-server.js'
import { createTestScope, POSTS } from './fixtures.js'

describe('startAppServer', () => {
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

  it('relays getUserProfile as plain data on success', async () => {
    const response = await fetch(`${appServer.baseUrl}/users/1/profile`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      posts: [
        { id: 1, userId: 1, title: 'Hello world', body: 'first post' },
        { id: 2, userId: 1, title: 'Second post', body: 'more thoughts' }
      ]
    })
  })

  it('relays getOrdersByUserId as plain data on success', async () => {
    const response = await fetch(`${appServer.baseUrl}/users/1/orders`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { id: 1, userId: 1, item: 'Difference Engine plans', amountCents: 5000 },
      { id: 2, userId: 1, item: 'Punch cards', amountCents: 1200 }
    ])
  })

  it('responds 502 with the error body when a resolver fails', async () => {
    const response = await fetch(`${appServer.baseUrl}/users/999/profile`)

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ code: 'USER_NOT_FOUND' })
  })

  it('404s on an unrecognized route rather than reaching a resolver', async () => {
    const response = await fetch(`${appServer.baseUrl}/nope`)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      code: 'ROUTE_NOT_FOUND',
      message: 'not found'
    })
  })
})
