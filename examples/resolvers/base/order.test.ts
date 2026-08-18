import { ok } from 'quoin'
import { getOrdersByUserId, getOrdersByUserIdPaged } from './order.js'
import { createTestScope } from '../../fixtures.js'
import type { IAppScope } from '../../scope.js'
import type { IOrder } from '../../db/connection.js'
import type { TAppResult } from '../../quoin.js'

describe('base order resolvers', () => {
  let scope: IAppScope

  beforeEach(() => {
    scope = createTestScope()
  })

  it('is declared base', () => {
    expect(getOrdersByUserId.info).toEqual({
      name: 'getOrdersByUserId',
      kind: 'base',
      type: 'resolver'
    })
  })

  it('resolves that user’s orders in id order', async () => {
    await expect(getOrdersByUserId({ userId: 1 }, scope)).resolves.toEqual(
      ok([
        {
          id: 1,
          userId: 1,
          item: 'Difference Engine plans',
          amountCents: 5000
        },
        { id: 2, userId: 1, item: 'Punch cards', amountCents: 1200 }
      ])
    )
  })

  it('scopes to the requested user rather than every user with orders', async () => {
    await expect(getOrdersByUserId({ userId: 2 }, scope)).resolves.toEqual(
      ok([
        {
          id: 3,
          userId: 2,
          item: 'Analytical Engine notes',
          amountCents: 9900
        }
      ])
    )
  })

  /** No orders is an answer, so it succeeds with an empty list rather than failing. */
  it('succeeds with an empty array for a user with no orders', async () => {
    await expect(getOrdersByUserId({ userId: 999 }, scope)).resolves.toEqual(ok([]))
  })
})

describe('getOrdersByUserIdPaged', () => {
  let scope: IAppScope

  beforeEach(() => {
    scope = createTestScope()
  })

  async function collect(
    params: { userId: number, pageSize?: number }
  ): Promise<TAppResult<IOrder[]>[]> {
    const pages: TAppResult<IOrder[]>[] = []
    for await (const page of getOrdersByUserIdPaged(params, scope)) {
      pages.push(page)
    }
    return pages
  }

  it('is declared base', () => {
    expect(getOrdersByUserIdPaged.info).toEqual({
      name: 'getOrdersByUserIdPaged',
      kind: 'base',
      type: 'iterativeResolver'
    })
  })

  it('streams one page per pageSize worth of orders, in id order', async () => {
    await expect(collect({ userId: 1, pageSize: 1 })).resolves.toEqual([
      ok([{ id: 1, userId: 1, item: 'Difference Engine plans', amountCents: 5000 }]),
      ok([{ id: 2, userId: 1, item: 'Punch cards', amountCents: 1200 }])
    ])
  })

  /** A page short of a full page is the signal to stop — no trailing empty fetch. */
  it('stops after a page that comes back short, without an extra empty page', async () => {
    await expect(collect({ userId: 1, pageSize: 2 })).resolves.toEqual([
      ok([
        { id: 1, userId: 1, item: 'Difference Engine plans', amountCents: 5000 },
        { id: 2, userId: 1, item: 'Punch cards', amountCents: 1200 }
      ])
    ])
  })

  it('yields nothing at all for a user with no orders', async () => {
    await expect(collect({ userId: 999 })).resolves.toEqual([])
  })

  it('defaults the page size when none is given', async () => {
    await expect(collect({ userId: 2 })).resolves.toEqual([
      ok([{ id: 3, userId: 2, item: 'Analytical Engine notes', amountCents: 9900 }])
    ])
  })
})
