import type { IScopeOptions, IResult, IOk, IFail } from 'quoin'
import { createDb, seed, type ISeedData } from './db/connection.js'
import type { IPost } from './api/client.js'
import { createAppScope, type IAppScope, type ISession } from './scope.js'

/**
 * Two users, one with several orders and one with a single order, so the LEFT
 * JOIN's null path and its WHERE clause are both exercised by the shared fixture
 * rather than by a one-off setup inside a single test.
 */
export const SEED: ISeedData = {
  users: [
    { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    { id: 2, name: 'Charles Babbage', email: 'charles@example.com' }
  ],
  orders: [
    { id: 1, userId: 1, item: 'Difference Engine plans', amountCents: 5000 },
    { id: 2, userId: 1, item: 'Punch cards', amountCents: 1200 },
    { id: 3, userId: 2, item: 'Analytical Engine notes', amountCents: 9900 }
  ]
}

export const POSTS: IPost[] = [
  { id: 1, userId: 1, title: 'Hello world', body: 'first post' },
  { id: 2, userId: 1, title: 'Second post', body: 'more thoughts' },
  { id: 3, userId: 2, title: 'Someone else', body: 'not ada' }
]

export const SEEDED_USER_IDS = SEED.users.map((user) => user.id)

/**
 * For suites that never touch scope.apiClient. Assembling the whole scope anyway
 * is the point — one scope, whatever a given call happens to use.
 */
export const UNUSED_API = 'http://127.0.0.1:1'

/**
 * `data` and `error` each live on one branch of the union, so a test has to narrow
 * before reaching for either — the same check a real caller makes. These assert and
 * narrow in one step, with no cast.
 */
export function assertOk<TOutput, TError>(
  result: IResult<TOutput, TError>
): asserts result is IOk<TOutput> {
  if (!result.success) {
    throw new Error(`Expected success, got failure: ${JSON.stringify(result.error)}`)
  }
}

export function assertFail<TOutput, TError>(
  result: IResult<TOutput, TError>
): asserts result is IFail<TError> {
  if (result.success) {
    throw new Error(`Expected failure, got success: ${JSON.stringify(result.data)}`)
  }
}

export function createTestScope(
  apiBaseUrl: string = UNUSED_API,
  session: ISession = { userId: null },
  options?: IScopeOptions
): IAppScope {
  const db = createDb()
  seed(db, SEED)
  return createAppScope(db, apiBaseUrl, session, options)
}
