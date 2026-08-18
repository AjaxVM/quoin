import type { TKind, IInfo } from './info.js'
import type { IResponse } from './result.js'
import { runIterativeCall, type TScope } from './scope.js'

/**
 * A resolver that streams rather than resolving once — pages, cursors, anything
 * where the caller wants values as they arrive instead of one collected array.
 * TResult is per-yielded-value, same as a regular resolver's TResult is per-call.
 */
export type IIterativeResolverFn<
  TParams = unknown,
  TCallScope extends TScope = TScope,
  TResult = IResponse
> = (params: TParams, scope: TCallScope) => AsyncGenerator<TResult, void>

export interface IIterativeResolver<
  TParams = unknown,
  TCallScope extends TScope = TScope,
  TResult = IResponse
> {
  (params: TParams, scope: TCallScope): AsyncGenerator<TResult, void>
  info: IInfo
}

function build<TParams, TCallScope extends TScope, TResult>(
  name: string,
  fn: IIterativeResolverFn<TParams, TCallScope, TResult>,
  kind: TKind
): IIterativeResolver<TParams, TCallScope, TResult> {
  const info: IInfo = { name, kind, type: 'iterativeResolver' }

  const wrapped = (params: TParams, scope: TCallScope): AsyncGenerator<TResult, void> =>
    runIterativeCall(info, scope, (innerScope) => fn(params, innerScope))

  return Object.assign(wrapped, { info })
}

/** Streams one source. */
export function iterativeResolver<TParams, TCallScope extends TScope, TResult = IResponse>(
  name: string,
  fn: IIterativeResolverFn<TParams, TCallScope, TResult>
): IIterativeResolver<TParams, TCallScope, TResult> {
  return build(name, fn, 'base')
}

/** Streams by calling other resolvers. */
export function compositeIterativeResolver<
  TParams,
  TCallScope extends TScope,
  TResult = IResponse
>(
  name: string,
  fn: IIterativeResolverFn<TParams, TCallScope, TResult>
): IIterativeResolver<TParams, TCallScope, TResult> {
  return build(name, fn, 'composite')
}
