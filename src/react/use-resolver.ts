import { useCallback } from 'react'
import type { IResolver } from '../resolver.js'
import type { TScope } from '../scope.js'
import { useQuoinScope } from './context.js'

/** A resolver bound to the scope from context — call it with just its params. */
export type IBoundResolver<TParams, TResult> = (params: TParams) => Promise<TResult>

export function useResolver<TParams, TCallScope extends TScope, TResult>(
  resolver: IResolver<TParams, TCallScope, TResult>
): IBoundResolver<TParams, TResult> {
  const scope = useQuoinScope<TCallScope>()
  return useCallback((params: TParams) => resolver(params, scope), [scope, resolver])
}
