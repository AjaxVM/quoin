/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { resolver, ok } from '../index.js'
import { QuoinProvider } from './context.js'
import { useResolver } from './use-resolver.js'

describe('useResolver', () => {
  it('binds the scope from context, so the returned function needs only params', async () => {
    const scope = { db: 'test-db' }
    const getThing = resolver('getThing', async (params: { id: number }, s: typeof scope) =>
      ok({ id: params.id, source: s.db })
    )
    const { result } = renderHook(() => useResolver(getThing), {
      wrapper: ({ children }) => <QuoinProvider scope={scope}>{children}</QuoinProvider>
    })

    await expect(result.current({ id: 1 })).resolves.toEqual(ok({ id: 1, source: 'test-db' }))
  })

  it('memoizes the bound function on [scope, resolver]', () => {
    const scope = { db: 'test-db' }
    const getThing = resolver('getThing', async () => ok('value'))
    const { result, rerender } = renderHook(() => useResolver(getThing), {
      wrapper: ({ children }) => <QuoinProvider scope={scope}>{children}</QuoinProvider>
    })
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })
})
