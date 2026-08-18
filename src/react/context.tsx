import { createContext, useContext, type ReactElement, type ReactNode } from 'react'
import type { TScope } from '../scope.js'

/**
 * Typed against the library's own TScope rather than any one app's scope shape —
 * a React context has exactly one value type for the whole tree. Each hook casts
 * back to whatever TCallScope the call it's given actually requires.
 */
export const QuoinScopeContext = createContext<TScope | undefined>(undefined)

export interface IQuoinProviderProps<TAppScope extends TScope> {
  scope: TAppScope
  children: ReactNode
}

/** Puts a scope on context so it doesn't have to be prop-drilled to every caller. */
export function QuoinProvider<TAppScope extends TScope>(
  { scope, children }: IQuoinProviderProps<TAppScope>
): ReactElement {
  return (
    <QuoinScopeContext.Provider value={scope}>
      {children}
    </QuoinScopeContext.Provider>
  )
}

export function useQuoinScope<TAppScope extends TScope>(): TAppScope {
  const scope = useContext(QuoinScopeContext)
  if (scope === undefined) {
    throw new Error('useQuoinScope must be used within a QuoinProvider')
  }
  return scope as TAppScope
}
