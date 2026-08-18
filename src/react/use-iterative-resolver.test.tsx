/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { iterativeResolver, ok } from '../index.js'
import { QuoinProvider } from './context.js'
import { useIterativeResolver } from './use-iterative-resolver.js'

describe('useIterativeResolver', () => {
  it('binds the scope, yielding every value the resolver yields', async () => {
    const scope = { db: 'test-db' }
    const getPages = iterativeResolver(
      'getPages',
      async function* (_params: null, s: typeof scope) {
        yield ok(`${s.db}-1`)
        yield ok(`${s.db}-2`)
      }
    )
    const { result } = renderHook(() => useIterativeResolver(getPages), {
      wrapper: ({ children }) => <QuoinProvider scope={scope}>{children}</QuoinProvider>
    })

    const values = []
    for await (const value of result.current(null)) {
      values.push(value)
    }

    expect(values).toEqual([ok('test-db-1'), ok('test-db-2')])
  })

  /** Pins iterative-resolver.ts's own rule: nothing runs until first pulled from. */
  it('does not start the generator until iterated', () => {
    const scope = {}
    let started = false
    const getPages = iterativeResolver('getPages', async function* () {
      started = true
      yield ok('value')
    })
    const { result } = renderHook(() => useIterativeResolver(getPages), {
      wrapper: ({ children }) => <QuoinProvider scope={scope}>{children}</QuoinProvider>
    })

    result.current(null)

    expect(started).toBe(false)
  })
})
