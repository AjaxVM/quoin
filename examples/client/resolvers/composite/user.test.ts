import { getUserProfileWithOrders } from './user.js'
import { startAppServer, type IAppServer } from '../../../server.js'
import { startMockApiServer, type IMockApiServer } from '../../../api/mock-server.js'
import { createTestScope, POSTS, assertOk, assertFail } from '../../../fixtures.js'
import { createClientScope } from '../../scope.js'

describe('client getUserProfileWithOrders', () => {
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

  it('is declared composite', () => {
    expect(getUserProfileWithOrders.info.kind).toBe('composite')
  })

  it('never trips the composition guard', async () => {
    const scope = createClientScope(appServer.baseUrl, { guard: 'error' })

    await expect(
      getUserProfileWithOrders({ id: 1 }, scope)
    ).resolves.toMatchObject({ success: true })
  })

  it('merges two independent HTTP calls into one client-side result', async () => {
    const scope = createClientScope(appServer.baseUrl, { metrics: true })

    const result = await getUserProfileWithOrders({ id: 1 }, scope)

    assertOk(result)
    expect(result.data).toEqual({
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      posts: [
        { id: 1, userId: 1, title: 'Hello world', body: 'first post' },
        { id: 2, userId: 1, title: 'Second post', body: 'more thoughts' }
      ],
      orders: [
        { id: 1, userId: 1, item: 'Difference Engine plans', amountCents: 5000 },
        { id: 2, userId: 1, item: 'Punch cards', amountCents: 1200 }
      ]
    })
    expect(scope.$quoin!.metrics!.map((metric) => metric.path.join(' > ')).sort()).toEqual([
      'getUserProfileWithOrders',
      'getUserProfileWithOrders > getOrdersByUserId',
      'getUserProfileWithOrders > getUserProfile'
    ])
  })

  it('fails when the profile leg fails, without reaching the orders leg\'s success', async () => {
    const scope = createClientScope(`${appServer.baseUrl}/wrong-prefix`)

    const result = await getUserProfileWithOrders({ id: 1 }, scope)

    assertFail(result)
    expect(result.error?.code).toBe('ROUTE_NOT_FOUND')
  })
})
