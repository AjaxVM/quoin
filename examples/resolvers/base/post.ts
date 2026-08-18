import { resolver } from 'quoin'
import type { IAppScope } from '../../scope.js'
import type { TAppResult } from '../../quoin.js'
import type { IPost } from '../../api/client.js'

/**
 * An HTTP source is still one source, so this is base. The client already returns
 * results, which makes this a pure relay — an outage propagates as a failure
 * without a try/catch here or in anything composing it.
 */
export const getPostsByUserId = resolver(
  'getPostsByUserId',
  async (params: { userId: number }, scope: IAppScope): Promise<TAppResult<IPost[]>> =>
    scope.apiClient.getPostsByUserId(params.userId)
)
