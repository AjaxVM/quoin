import { createScope, type TScope, type IScopeOptions } from 'quoin'
import { createAppApiClient, type IAppApiClient } from './api.js'

/**
 * The browser-side counterpart to examples/scope.ts. Same `createScope`, same
 * optional guard/metrics, same shape as the server — what changes is what a scope
 * holds. `appApi` here plays the role `apiClient` plays server-side: built once
 * from the base URL, so no call site re-encodes it per request.
 */
export interface IClientFields {
  appApi: IAppApiClient
}

export type IClientScope = TScope<IClientFields>

export function createClientScope(appBaseUrl: string, options?: IScopeOptions): IClientScope {
  return createScope({ appApi: createAppApiClient(appBaseUrl) }, options)
}
