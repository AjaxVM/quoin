import type { TKind, IInfo } from './info.js'
import type { IResponse } from './result.js'
import { runCall, type TScope } from './scope.js'

/**
 * TResult defaults to the result shape, but is its own slot rather than derived
 * from separate TData/TError generics — so a resolver's contract can fix TResult
 * outright to anything, result-shaped or not, not only override one of the
 * result's two sides.
 */
export type IResolverFn<
  TParams = unknown,
  TCallScope extends TScope = TScope,
  TResult = IResponse
> = (
  params: TParams,
  scope: TCallScope
) => TResult | Promise<TResult>

export interface IResolver<
  TParams = unknown,
  TCallScope extends TScope = TScope,
  TResult = IResponse
> {
  (params: TParams, scope: TCallScope): Promise<TResult>
  info: IInfo
}

function build<TParams, TCallScope extends TScope, TResult>(
  name: string,
  fn: IResolverFn<TParams, TCallScope, TResult>,
  kind: TKind
): IResolver<TParams, TCallScope, TResult> {
  const info: IInfo = { name, kind, type: 'resolver' }

  const wrapped = (params: TParams, scope: TCallScope): Promise<TResult> =>
    runCall(info, scope, (innerScope) => fn(params, innerScope))

  return Object.assign(wrapped, { info })
}

/** Reads one piece of data from one source. */
export function resolver<TParams, TCallScope extends TScope, TResult = IResponse>(
  name: string,
  fn: IResolverFn<TParams, TCallScope, TResult>
): IResolver<TParams, TCallScope, TResult> {
  return build(name, fn, 'base')
}

/** Reads by calling other resolvers. */
export function compositeResolver<TParams, TCallScope extends TScope, TResult = IResponse>(
  name: string,
  fn: IResolverFn<TParams, TCallScope, TResult>
): IResolver<TParams, TCallScope, TResult> {
  return build(name, fn, 'composite')
}
