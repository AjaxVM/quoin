import { resolver, mutator, ok, fail } from 'quoin'
import type { IAppScope } from '../../scope.js'
import type { IAppError, TAppResult } from '../../quoin.js'
import type { IUser } from '../../db/connection.js'
import { queryOne, execute, int, text } from '../../db/query.js'

const USER_COLUMNS = { id: int, name: text, email: text }
const SELECT_USER = 'SELECT id, name, email FROM users WHERE id = ?'

const notFound = (id: number): IAppError => ({
  code: 'USER_NOT_FOUND',
  message: `User ${id} not found`
})

/**
 * Parameters are annotated rather than passed as type arguments, which is what
 * lets Quoin infer both the data and the error type from the body. Supplying any
 * type argument would make the rest fall back to their defaults instead.
 *
 * The return annotation is optional — it pins the contract instead of inferring it.
 */
export const getUserById = resolver(
  'getUserById',
  async (params: { id: number }, scope: IAppScope): Promise<TAppResult<IUser>> => {
    const row = queryOne(scope.db, SELECT_USER, [params.id], USER_COLUMNS)
    return row ? ok(row) : fail(notFound(params.id))
  }
)

/**
 * Succeeds with nothing to return, so `ok()` takes no argument.
 *
 * The missing-row check belongs here, not in the composite above it: otherwise an
 * update to a nonexistent user writes nothing and fails later in a *read*, which
 * looks like a lookup bug rather than a no-op write.
 */
export const setUserEmail = mutator(
  'setUserEmail',
  async (
    params: { id: number },
    value: { email: string },
    scope: IAppScope
  ): Promise<TAppResult> => {
    const { changes } = execute(scope.db, 'UPDATE users SET email = ? WHERE id = ?', [
      value.email,
      params.id
    ])
    return changes === 0 ? fail(notFound(params.id)) : ok()
  }
)
