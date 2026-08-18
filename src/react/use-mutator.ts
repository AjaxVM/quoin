import { useCallback } from 'react'
import type { IMutator } from '../mutator.js'
import type { TScope } from '../scope.js'
import { useQuoinScope } from './context.js'

/** A mutator bound to the scope from context — call it with just params and value. */
export type IBoundMutator<TParams, TValue, TResult>
  = (params: TParams, value: TValue) => Promise<TResult>

export function useMutator<TParams, TValue, TCallScope extends TScope, TResult>(
  mutator: IMutator<TParams, TValue, TCallScope, TResult>
): IBoundMutator<TParams, TValue, TResult> {
  const scope = useQuoinScope<TCallScope>()
  return useCallback(
    (params: TParams, value: TValue) => mutator(params, value, scope),
    [scope, mutator]
  )
}
