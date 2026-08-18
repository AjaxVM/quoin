import { getOrdersByUserId } from './order.js'
import { startAppServer, type IAppServer } from '../../../server.js'
import { startMockApiServer, type IMockApiServer } from '../../../api/mock-server.js'
import { createTestScope, POSTS, assertOk } from '../../../fixtures.js'
import { createClientScope } from '../../scope.js'

describe('client getOrdersByUserId', () => {
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

  it('is declared base', () => {
    expect(getOrdersByUserId.info.kind).toBe('base')
  })

  it('fetches the same shape getOrdersByUserId returns server-side', async () => {
    const result = await getOrdersByUserId({ userId: 1 }, createClientScope(appServer.baseUrl))

    assertOk(result)
    expect(result.data).toEqual([
      { id: 1, userId: 1, item: 'Difference Engine plans', amountCents: 5000 },
      { id: 2, userId: 1, item: 'Punch cards', amountCents: 1200 }
    ])
  })
})
