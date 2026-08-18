import { jest } from '@jest/globals'
import { mutator, compositeMutator } from './mutator.js'
import { resolver } from './resolver.js'
import { ok, fail } from './result.js'
import { createScope } from './scope.js'

describe('mutator', () => {
  it('tags the wrapped function with an info object', () => {
    const updateThing = mutator('updateThing', async () => ok('value'))

    expect(updateThing.info).toEqual({ name: 'updateThing', kind: 'base', type: 'mutator' })
  })

  it('tags a composite mutator with kind "composite"', () => {
    const updateComposite = compositeMutator('updateComposite', async () => ok('value'))

    expect(updateComposite.info).toEqual({
      name: 'updateComposite',
      kind: 'composite',
      type: 'mutator'
    })
  })

  it('does not mutate the function it was given', () => {
    const inner = async () => ok('value')
    const updateThing = mutator('updateThing', inner)

    expect(updateThing).not.toBe(inner)
    expect(inner).not.toHaveProperty('info')
  })

  it('returns a promise even when the inner function is synchronous', async () => {
    const updateThing = mutator('updateThing', () => ok('sync value'))

    const returned = updateThing({}, {}, {})

    expect(returned).toBeInstanceOf(Promise)
    await expect(returned).resolves.toEqual(ok('sync value'))
  })

  it('passes params and value through untouched, with scope carrying app fields plus $quoin', async () => {
    const inner = jest.fn(
      async (params: { id: number }, value: { email: string }, scope: { db: string }) =>
        ok({ id: params.id, email: value.email, source: scope.db })
    )
    const updateThing = mutator('updateThing', inner)
    const params = { id: 1 }
    const value = { email: 'new@example.com' }

    await updateThing(params, value, { db: 'test-db' })

    expect(inner).toHaveBeenCalledTimes(1)
    const [passedParams, passedValue, passedScope] = inner.mock.calls[0] as [
      unknown,
      unknown,
      Record<string, unknown>
    ]
    expect(passedParams).toBe(params)
    expect(passedValue).toBe(value)
    expect(passedScope.db).toBe('test-db')
    expect(passedScope.$quoin).toMatchObject({
      frame: { info: updateThing.info, children: [] }
    })
  })

  it("resolves with the inner function's result", async () => {
    const updateThing = mutator('updateThing', async () => ok({ id: 1, updated: true }))

    await expect(updateThing({}, {}, {})).resolves.toEqual(ok({ id: 1, updated: true }))
  })

  it('returns a failure result without throwing', async () => {
    const error = { code: 'WRITE_REJECTED', message: 'write failed' }
    const updateThing = mutator('updateThing', async () => fail(error))

    await expect(updateThing({}, {}, {})).resolves.toEqual({
      success: false,
      error
    })
  })

  it('still propagates a thrown error — that is a bug, not a result', async () => {
    const updateThing = mutator('updateThing', async () => {
      throw new Error('genuine defect')
    })

    await expect(updateThing({}, {}, {})).rejects.toThrow('genuine defect')
  })

  it('can call a resolver from within a composite mutator’s body', async () => {
    const getThing = resolver('getThing', async () => ok({ id: 1, name: 'fresh' }))
    const updateThenGet = compositeMutator('updateThenGet', async (params, _value, scope) =>
      getThing(params, scope)
    )

    await expect(updateThenGet({}, {}, {})).resolves.toEqual(ok({ id: 1, name: 'fresh' }))
  })

  /**
   * The non-atomicity case. A composite mutator whose write lands and whose next
   * step fails must say so — a caller seeing a bare failure is entitled to assume
   * nothing happened.
   */
  it('can report what already applied when a later step fails', async () => {
    const setThing = mutator('setThing', async () => ok())
    const getThing = resolver('getThing', async () =>
      fail({ code: 'READ_BACK_FAILED', message: 'gone' })
    )
    const updateThenGet = compositeMutator(
      'updateThenGet',
      async (params: unknown, value: unknown, scope: object) => {
        const written = await setThing(params, value, scope)
        if (!written.success) {
          return written
        }

        const fresh = await getThing(params, scope)
        if (!fresh.success) {
          return fail({ ...fresh.error, applied: [setThing.info.name] })
        }
        return fresh
      }
    )

    const result = await updateThenGet({}, {}, {})

    if (result.success) {
      throw new Error('expected failure')
    }
    expect(result.error).toEqual({
      code: 'READ_BACK_FAILED',
      message: 'gone',
      applied: ['setThing']
    })
  })
})

describe('mutator composition guard', () => {
  const silenceWarnings = () => jest.spyOn(console, 'warn').mockImplementation(() => {})
  let warn: ReturnType<typeof silenceWarnings>

  beforeEach(() => {
    warn = silenceWarnings()
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('warns when a base mutator calls a resolver', async () => {
    const getThing = resolver('getThing', async () => ok({ id: 1 }))
    const updateThenGet = mutator('updateThenGet', async (params, _value, scope) =>
      getThing(params, scope)
    )

    await updateThenGet({}, {}, {})

    expect(warn.mock.calls[0][0]).toContain('"updateThenGet" is declared base but called getThing')
  })

  it('stays quiet once it is declared a composite mutator', async () => {
    const getThing = resolver('getThing', async () => ok({ id: 1 }))
    const updateThenGet = compositeMutator('updateThenGet', async (params, _value, scope) =>
      getThing(params, scope)
    )

    await updateThenGet({}, {}, createScope({}))

    expect(warn).not.toHaveBeenCalled()
  })
})
