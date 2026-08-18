import type { DatabaseSync } from 'node:sqlite'
// Imported by name, as a consumer would. A tsconfig path and matching jest alias
// point 'quoin' at src/, so these run in-repo without a build.
import { createScope, type TScope, type IScopeOptions } from 'quoin'
import { createPostsApiClient, type IPostsApiClient } from './api/client.js'
import { createCacheStore, type ICacheStore } from './cache/store.js'

export interface ISession {
  userId: number | null
}

/**
 * One scope for the app. Nothing stops you having several — per source, or a fresh
 * one per request — as long as every resolver's scope holds what it and everything
 * it calls will reach. getUserProfile spans the DB and the API, so both must be here.
 * One app-wide scope is the cheapest way to never get that wrong.
 */
export interface IAppFields {
  db: DatabaseSync
  apiClient: IPostsApiClient
  session: ISession
  cacheStore: ICacheStore
}

export type IAppScope = TScope<IAppFields>

export function createAppScope(
  db: DatabaseSync,
  apiBaseUrl: string,
  session: ISession = { userId: null },
  options?: IScopeOptions
): IAppScope {
  return createScope(
    { db, apiClient: createPostsApiClient(apiBaseUrl), session, cacheStore: createCacheStore() },
    options
  )
}
