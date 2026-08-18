/** @jest-environment jsdom */
import { render, renderHook } from '@testing-library/react'
import { QuoinProvider, useQuoinScope } from './context.js'

describe('QuoinProvider / useQuoinScope', () => {
  it('makes the scope passed to QuoinProvider available via useQuoinScope', () => {
    const scope = { db: 'test-db' }
    const { result } = renderHook(() => useQuoinScope(), {
      wrapper: ({ children }) => <QuoinProvider scope={scope}>{children}</QuoinProvider>
    })

    expect(result.current).toBe(scope)
  })

  it('throws when used outside a QuoinProvider', () => {
    expect(() => renderHook(() => useQuoinScope())).toThrow(
      'useQuoinScope must be used within a QuoinProvider'
    )
  })

  it('renders its children', () => {
    const { container } = render(
      <QuoinProvider scope={{}}>
        <span>inside</span>
      </QuoinProvider>
    )

    expect(container.textContent).toBe('inside')
  })
})
