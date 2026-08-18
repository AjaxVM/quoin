import type { TKind, IInfo } from './info.js'
import type { IResponse } from './result.js'
import { runCall, type TScope } from './scope.js'

/**
 * A mutator's params say what to change; value is the new data — that's the
 * real difference from a resolver, not just the name.
 *
 * TResult defaults to the result shape, but is its own slot rather than derived
 * from separate TData/TError generics — so a mutator's contract can fix TResult
 * outright to anything, result-shaped or not, not only override one of the
 * result's two sides.
 */
export type IMutatorFn<
  TParams = unknown,
  TValue = unknown,
  TCallScope extends TScope = TScope,
  TResult = IResponse
> = (
  params: TParams,
  value: TValue,
  scope: TCallScope
) => TResult | Promise<TResult>

export interface IMutator<
  TParams = unknown,
  TValue = unknown,
  TCallScope extends TScope = TScope,
  TResult = IResponse
> {
  (params: TParams, value: TValue, scope: TCallScope): Promise<TResult>
  info: IInfo
}

function build<TParams, TValue, TCallScope extends TScope, TResult>(
  name: string,
  fn: IMutatorFn<TParams, TValue, TCallScope, TResult>,
  kind: TKind
): IMutator<TParams, TValue, TCallScope, TResult> {
  const info: IInfo = { name, kind, type: 'mutator' }

  const wrapped = (
    params: TParams,
    value: TValue,
    scope: TCallScope
  ): Promise<TResult> =>
    runCall(info, scope, (innerScope) => fn(params, value, innerScope))

  return Object.assign(wrapped, { info })
}

/** Writes one piece of data to one source. */
export function mutator<TParams, TValue, TCallScope extends TScope, TResult = IResponse>(
  name: string,
  fn: IMutatorFn<TParams, TValue, TCallScope, TResult>
): IMutator<TParams, TValue, TCallScope, TResult> {
  return build(name, fn, 'base')
}

/** Writes by calling other resolvers or mutators. Not atomic — say what already applied. */
export function compositeMutator<
  TParams,
  TValue,
  TCallScope extends TScope,
  TResult = IResponse
>(
  name: string,
  fn: IMutatorFn<TParams, TValue, TCallScope, TResult>
): IMutator<TParams, TValue, TCallScope, TResult> {
  return build(name, fn, 'composite')
}
