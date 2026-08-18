import { resolver, iterativeResolver, ok } from 'quoin'
import type { IAppScope } from '../../scope.js'
import type { TAppResult } from '../../quoin.js'
import type { IOrder } from '../../db/connection.js'
import { queryAll, int, text, type TRow } from '../../db/query.js'

export const ORDER_COLUMNS = { id: int, user_id: int, item: text, amount_cents: int }

function mapOrderRow(row: TRow<typeof ORDER_COLUMNS>): IOrder {
  return {
    id: row.id,
    userId: row.user_id,
    item: row.item,
    amountCents: row.amount_cents
  }
}

/** No failure case — a user with no orders has no orders, which is an answer. */
export const getOrdersByUserId = resolver(
  'getOrdersByUserId',
  async (params: { userId: number }, scope: IAppScope): Promise<TAppResult<IOrder[]>> => {
    const rows = queryAll(
      scope.db,
      'SELECT id, user_id, item, amount_cents FROM orders WHERE user_id = ? ORDER BY id',
      [params.userId],
      ORDER_COLUMNS
    )
    return ok(rows.map(mapOrderRow))
  }
)

export const DEFAULT_ORDER_PAGE_SIZE = 25

/**
 * Streams a user's orders page by page instead of collecting them all up front —
 * for a result set too big to want in memory at once. Each yielded result is one
 * page; the stream ends the moment a page comes back short of a full page
 * (including a first, empty one), so it never issues a query it doesn't need to
 * know it's done.
 */
export const getOrdersByUserIdPaged = iterativeResolver(
  'getOrdersByUserIdPaged',
  async function* (
    params: { userId: number, pageSize?: number },
    scope: IAppScope
  ): AsyncGenerator<TAppResult<IOrder[]>, void> {
    const pageSize = params.pageSize ?? DEFAULT_ORDER_PAGE_SIZE
    let offset = 0

    while (true) {
      const rows = queryAll(
        scope.db,
        'SELECT id, user_id, item, amount_cents FROM orders WHERE user_id = ? ORDER BY id '
        + 'LIMIT ? OFFSET ?',
        [params.userId, pageSize, offset],
        ORDER_COLUMNS
      )
      if (rows.length === 0) {
        return
      }

      yield ok(rows.map(mapOrderRow))

      if (rows.length < pageSize) {
        return
      }
      offset += pageSize
    }
  }
)
