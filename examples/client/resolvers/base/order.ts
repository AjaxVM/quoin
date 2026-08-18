import { resolver, ok, fail } from 'quoin'
import type { IClientScope } from '../../scope.js'
import type { TAppResult, IAppError } from '../../../quoin.js'
import type { IOrder } from '../../../db/connection.js'

/**
 * Same name as the server's getOrdersByUserId, base on both sides for the same
 * reason: one source, just a different one — an HTTP endpoint here instead of
 * `scope.db`. See getUserProfile (sibling file) for why the mapping happens here
 * rather than in `scope.appApi`.
 */
export const getOrdersByUserId = resolver(
  'getOrdersByUserId',
  async (params: { userId: number }, scope: IClientScope): Promise<TAppResult<IOrder[]>> => {
    const response = await scope.appApi.get(`/users/${params.userId}/orders`)
    return response.ok ? ok(response.body as IOrder[]) : fail(response.body as IAppError)
  }
)
