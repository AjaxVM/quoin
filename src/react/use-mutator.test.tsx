/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { mutator, ok } from '../index.js'
import { QuoinProvider } from './context.js'
import { useMutator } from './use-mutator.js'

describe('useMutator', () => {
  it('binds the scope from context, so the returned function needs only params and value', async () => {
    const scope = { db: 'test-db' }
    const setThing = mutator(
      'setThing',
      async (params: { id: number }, value: { name: string }, s: typeof scope) =>
        ok({ id: params.id, name: value.name, source: s.db })
    )
    const { result } = renderHook(() => useMutator(setThing), {
      wrapper: ({ children }) => <QuoinProvider scope={scope}>{children}</QuoinProvider>
    })

    await expect(result.current({ id: 1 }, { name: 'Ada' })).resolves.toEqual(
      ok({ id: 1, name: 'Ada', source: 'test-db' })
    )
  })

  it('memoizes the bound function on [scope, mutator]', () => {
    const scope = { db: 'test-db' }
    const setThing = mutator('setThing', async () => ok())
    const { result, rerender } = renderHook(() => useMutator(setThing), {
      wrapper: ({ children }) => <QuoinProvider scope={scope}>{children}</QuoinProvider>
    })
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })
})
