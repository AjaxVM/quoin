import { compositeResolver, compositeMutator, ok, fail } from 'quoin'
import type { IAppScope } from '../../scope.js'
import type { TAppResult, IAppError } from '../../quoin.js'
import type { IUser, IOrder } from '../../db/connection.js'
import type { IPost } from '../../api/client.js'
import { queryAll, int, text, nullable } from '../../db/query.js'
import { getUserById, setUserEmail } from '../base/user.js'
import { getOrdersByUserId } from '../base/order.js'
import { getPostsByUserId } from '../base/post.js'

export interface IUserWithOrders extends IUser {
  orders: IOrder[]
}

export interface IUserProfile extends IUser {
  posts: IPost[]
  /**
   * Set when the posts side failed — `posts` is `[]` because it's unknown, not
   * because there are none. Absent means the fetch actually succeeded empty.
   */
  postsError?: IAppError
}

/**
 * `null` params: what to fetch is already on the scope. The session's own
 * `userId` is the identity — no need to fetch the user row first just to read
 * that same id back out, the app already put it there.
 */
export const getCurrentUserOrders = compositeResolver(
  'getCurrentUserOrders',
  async (_params: null, scope: IAppScope): Promise<TAppResult<IOrder[]>> => {
    const { userId } = scope.session
    if (userId === null) {
      return fail({ code: 'NOT_AUTHENTICATED', message: 'No signed-in user' })
    }

    return getOrdersByUserId({ userId }, scope)
  }
)

/**
 * Writes, then reads back. Sequential and non-atomic: if the write lands and the
 * read fails, the email really did change, so the failure records what applied. A
 * failure without `applied` means nothing happened, and callers rely on that.
 */
export const updateUserEmail = compositeMutator(
  'updateUserEmail',
  async (
    params: { id: number },
    value: { email: string },
    scope: IAppScope
  ): Promise<TAppResult<IUser>> => {
    const written = await setUserEmail(params, value, scope)
    if (!written.success) {
      return written
    }

    const fresh = await getUserById(params, scope)
    if (!fresh.success) {
      // Its own condition, not the read's — passing USER_NOT_FOUND through would
      // describe the wrong thing. The write landed, and `applied` says so.
      return fail({
        code: 'USER_READ_BACK_FAILED',
        message: `Email updated but user ${params.id} could not be read back`,
        cause: fresh.error,
        applied: [setUserEmail.info.name]
      })
    }

    return ok(fresh.data)
  }
)

/**
 * Independent reads, so they go out together. Each is still checked on its own —
 * which one failed is information the caller may want.
 */
export const getUserWithOrders = compositeResolver(
  'getUserWithOrders',
  async (params: { id: number }, scope: IAppScope): Promise<TAppResult<IUserWithOrders>> => {
    const [user, orders] = await Promise.all([
      getUserById({ id: params.id }, scope),
      getOrdersByUserId({ userId: params.id }, scope)
    ])
    if (!user.success) {
      return user
    }
    if (!orders.success) {
      return orders
    }

    return ok({ ...user.data, orders: orders.data })
  }
)

const JOIN_COLUMNS = {
  id: int,
  name: text,
  email: text,
  order_id: nullable(int),
  item: nullable(text),
  amount_cents: nullable(int)
}

/**
 * The same result as getUserWithOrders from one LEFT JOIN. Still a plain
 * compositeResolver — "optimized" is a naming distinction, not a different factory.
 *
 * Only worth writing when a measurement says so. Reaching past the base resolvers
 * to the source is what buys the speed and what costs the reuse, so it carries an
 * obligation: match the composed version exactly, including how it fails.
 */
export const getUserWithOrdersOptimized = compositeResolver(
  'getUserWithOrdersOptimized',
  async (params: { id: number }, scope: IAppScope): Promise<TAppResult<IUserWithOrders>> => {
    const rows = queryAll(
      scope.db,
      `SELECT u.id as id, u.name as name, u.email as email,
              o.id as order_id, o.item as item, o.amount_cents as amount_cents
       FROM users u LEFT JOIN orders o ON o.user_id = u.id
       WHERE u.id = ?
       ORDER BY o.id`,
      [params.id],
      JOIN_COLUMNS
    )

    if (rows.length === 0) {
      return fail({ code: 'USER_NOT_FOUND', message: `User ${params.id} not found` })
    }

    const { id, name, email } = rows[0]
    // userId from the parent row, not the joined row — equivalent only because
    // WHERE u.id = ? pins every row to this one user.
    const orders = rows
      .filter((row) => row.order_id !== null)
      .map((row) => ({
        id: row.order_id as number,
        userId: id,
        item: row.item as string,
        amountCents: row.amount_cents as number
      }))

    return ok({ id, name, email, orders })
  }
)

/**
 * Two sources, one scope. No optimized twin is possible — SQL and HTTP don't fold
 * into one round trip.
 *
 * Degrades rather than failing outright: the user is the part a profile can't do
 * without, but a profile missing its posts is still a profile. Since failures are
 * data, "user succeeded, posts failed" is representable without an exception —
 * `postsError` carries the failure so a caller can tell "nobody has posted" from
 * "we couldn't ask".
 */
export const getUserProfile = compositeResolver(
  'getUserProfile',
  async (params: { id: number }, scope: IAppScope): Promise<TAppResult<IUserProfile>> => {
    const [user, posts] = await Promise.all([
      getUserById({ id: params.id }, scope),
      getPostsByUserId({ userId: params.id }, scope)
    ])
    if (!user.success) {
      return user
    }

    return posts.success
      ? ok({ ...user.data, posts: posts.data })
      : ok({ ...user.data, posts: [], postsError: posts.error })
  }
)
