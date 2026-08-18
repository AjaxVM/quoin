import { compositeResolver, ok } from 'quoin'
import type { IClientScope } from '../../scope.js'
import type { TAppResult } from '../../../quoin.js'
import type { IUserProfile } from '../../../resolvers/composite/user.js'
import type { IOrder } from '../../../db/connection.js'
import { getUserProfile } from '../base/user.js'
import { getOrdersByUserId } from '../base/order.js'

export interface IUserProfileWithOrders extends IUserProfile {
  orders: IOrder[]
}

/**
 * Independent reads, so they go out together — the same shape as the server's
 * getUserWithOrders, just composing two HTTP calls instead of a DB query and an
 * HTTP call. Composition looks the same regardless of what's on the other side of
 * a base resolver, which is the point of the whole exercise.
 */
export const getUserProfileWithOrders = compositeResolver(
  'getUserProfileWithOrders',
  async (
    params: { id: number },
    scope: IClientScope
  ): Promise<TAppResult<IUserProfileWithOrders>> => {
    const [profile, orders] = await Promise.all([
      getUserProfile({ id: params.id }, scope),
      getOrdersByUserId({ userId: params.id }, scope)
    ])
    if (!profile.success) {
      return profile
    }
    if (!orders.success) {
      return orders
    }

    return ok({ ...profile.data, orders: orders.data })
  }
)
