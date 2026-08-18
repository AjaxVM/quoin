import { useCallback } from 'react'
import type { IIterativeResolver } from '../iterative-resolver.js'
import type { TScope } from '../scope.js'
import { useQuoinScope } from './context.js'

/** An iterative resolver bound to the scope from context — call it with just its params. */
export type IBoundIterativeResolver<TParams, TResult>
  = (params: TParams) => AsyncGenerator<TResult, void>

export function useIterativeResolver<TParams, TCallScope extends TScope, TResult>(
  iterativeResolver: IIterativeResolver<TParams, TCallScope, TResult>
): IBoundIterativeResolver<TParams, TResult> {
  const scope = useQuoinScope<TCallScope>()
  // An async generator function, not a function returning a promise of one —
  // matching iterative-resolver.ts's rule that nothing runs (no call frame, no
  // guard, no metric) until the first .next() pulls from it.
  return useCallback(
    async function* boundIterativeResolver(params: TParams) {
      yield* iterativeResolver(params, scope)
    },
    [scope, iterativeResolver]
  )
}
