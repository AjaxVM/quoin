import { resolver, ok, fail } from 'quoin'
import type { IClientScope } from '../../scope.js'
import type { TAppResult, IAppError } from '../../../quoin.js'
import type { IUserProfile } from '../../../resolvers/composite/user.js'

/**
 * One HTTP source, so this is base — even though the server composed it from two
 * (DB and the posts API). A client "optimized" composite is just a base resolver
 * against a use-case endpoint: the server did the composing, the browser only
 * asks for the view it needs in one round trip. Same name as the server's
 * getUserProfile, same params, same result type — the source is the only thing
 * that changed.
 *
 * `scope.appApi` is a thin transport — it doesn't know ok/fail. Mapping its
 * `{ok, status, body}` into a result is this resolver's own job.
 */
export const getUserProfile = resolver(
  'getUserProfile',
  async (params: { id: number }, scope: IClientScope): Promise<TAppResult<IUserProfile>> => {
    const response = await scope.appApi.get(`/users/${params.id}/profile`)
    return response.ok ? ok(response.body as IUserProfile) : fail(response.body as IAppError)
  }
)
