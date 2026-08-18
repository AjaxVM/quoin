import { jest } from '@jest/globals'
import { resolver, compositeResolver } from './resolver.js'
import { ok, fail } from './result.js'
import { createScope } from './scope.js'

describe('resolver', () => {
  it('tags the wrapped function with an info object', () => {
    const getThing = resolver('getThing', async () => ok('value'))

    expect(getThing.info).toEqual({ name: 'getThing', kind: 'base', type: 'resolver' })
  })

  it('tags a composite resolver with kind "composite"', () => {
    const getComposite = compositeResolver('getComposite', async () => ok('value'))

    expect(getComposite.info).toEqual({
      name: 'getComposite',
      kind: 'composite',
      type: 'resolver'
    })
  })

  it('does not mutate the function it was given', () => {
    const inner = async () => ok('value')
    const getThing = resolver('getThing', inner)

    expect(getThing).not.toBe(inner)
    expect(inner).not.toHaveProperty('info')
  })

  it('returns a promise even when the inner function is synchronous', async () => {
    const getThing = resolver('getThing', () => ok('sync value'))

    const returned = getThing({}, {})

    expect(returned).toBeInstanceOf(Promise)
    await expect(returned).resolves.toEqual(ok('sync value'))
  })

  it('passes the exact params through, and a scope carrying the app fields plus $quoin', async () => {
    const inner = jest.fn(async (params: { id: number }, scope: { db: string }) =>
      ok({ id: params.id, source: scope.db })
    )
    const getThing = resolver('getThing', inner)
    const params = { id: 1 }

    await getThing(params, { db: 'test-db' })

    expect(inner).toHaveBeenCalledTimes(1)
    const [passedParams, passedScope] = inner.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(passedParams).toBe(params)
    expect(passedScope.db).toBe('test-db')
    expect(passedScope.$quoin).toMatchObject({
      frame: { info: getThing.info, children: [] }
    })
  })

  it('hands the caller’s own scope straight through when the guard is off', async () => {
    const inner = jest.fn(async (_params: unknown, _scope: unknown) => ok('value'))
    const getThing = resolver('getThing', inner)
    const scope = createScope({ db: 'test-db' }, { guard: 'off' })

    await getThing({}, scope)

    expect(inner.mock.calls[0][1]).toBe(scope)
  })

  it("resolves with the inner function's result", async () => {
    const getThing = resolver('getThing', async () => ok({ id: 1 }))

    await expect(getThing({}, {})).resolves.toEqual(ok({ id: 1 }))
  })

  /** The core of the design: an anticipated failure comes back, it does not throw. */
  it('returns a failure result without throwing', async () => {
    const error = { code: 'NOT_FOUND', message: 'not found' }
    const getThing = resolver('getThing', async () => fail(error))

    const result = await getThing({}, {})

    expect(result).toEqual({ success: false, error })
  })

  it('still propagates a thrown error — that is a bug, not a result', async () => {
    const getThing = resolver('getThing', async () => {
      throw new Error('genuine defect')
    })

    await expect(getThing({}, {})).rejects.toThrow('genuine defect')
  })

  it('still propagates a returned rejected promise', async () => {
    const getThing = resolver('getThing', () => Promise.reject(new Error('genuine defect')))

    await expect(getThing({}, {})).rejects.toThrow('genuine defect')
  })

  it("can call other resolvers from within a composite's body", async () => {
    const getA = resolver('getA', async () => ok('a'))
    const getB = resolver('getB', async () => ok('b'))
    const getBoth = compositeResolver('getBoth', async (params: unknown, scope: object) => {
      const [a, b] = await Promise.all([getA(params, scope), getB(params, scope)])
      if (!a.success) {
        return a
      }
      if (!b.success) {
        return b
      }
      return ok({ a: a.data, b: b.data })
    })

    await expect(getBoth({}, {})).resolves.toEqual(ok({ a: 'a', b: 'b' }))
  })
})

describe('resolver composition guard', () => {
  // Inferred from a non-generic helper. `ReturnType<typeof jest.spyOn>` resolves
  // to `any`, since spyOn is generic and has nothing here to resolve it against.
  const silenceWarnings = () => jest.spyOn(console, 'warn').mockImplementation(() => {})
  let warn: ReturnType<typeof silenceWarnings>

  beforeEach(() => {
    warn = silenceWarnings()
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('warns when a base resolver calls another resolver', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const getOuter = resolver('getOuter', async (params, scope) => getA(params, scope))

    await getOuter({}, {})

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('"getOuter" is declared base but called getA')
  })

  it('names every resolver a base called, including concurrent ones', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const getB = resolver('getB', async () => ok('b'))
    const getOuter = resolver('getOuter', async (params, scope) => {
      await Promise.all([getA(params, scope), getB(params, scope)])
      return ok(null)
    })

    await getOuter({}, {})

    expect(warn.mock.calls[0][0]).toContain('called getA, getB')
  })

  /** The guard is about how a resolver is declared, not whether it succeeded. */
  it('warns even when the body returns a failure', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const getOuter = resolver('getOuter', async (params, scope) => {
      await getA(params, scope)
      return fail({ code: 'NOPE', message: 'nope' })
    })

    await getOuter({}, {})

    expect(warn.mock.calls[0][0]).toContain('"getOuter" is declared base but called getA')
  })

  it('stays quiet for a composite, however deep the chain', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const getMiddle = compositeResolver('getMiddle', async (params, scope) =>
      getA(params, scope)
    )
    const getOuter = compositeResolver('getOuter', async (params, scope) =>
      getMiddle(params, scope)
    )

    await getOuter({}, {})

    expect(warn).not.toHaveBeenCalled()
  })

  it('does not attribute concurrent siblings to each other', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const getB = resolver('getB', async () => ok('b'))
    const getBoth = compositeResolver('getBoth', async (params, scope) => {
      await Promise.all([getA(params, scope), getB(params, scope)])
      return ok(null)
    })

    await getBoth({}, {})

    expect(warn).not.toHaveBeenCalled()
  })

  it('rejects instead of warning when the guard is set to "error"', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const getOuter = resolver('getOuter', async (params, scope) => getA(params, scope))
    const scope = createScope({}, { guard: 'error' })

    await expect(getOuter({}, scope)).rejects.toThrow(
      '"getOuter" is declared base but called getA'
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('says nothing when the guard is off', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const getOuter = resolver('getOuter', async (params, scope) => getA(params, scope))

    await getOuter({}, createScope({}, { guard: 'off' }))

    expect(warn).not.toHaveBeenCalled()
  })

  /**
   * Pins the documented boundary rather than a bug: the guard watches calls between
   * resolvers, not what a single resolver does inside itself. Catching this would
   * mean instrumenting the scope's resources, which is deliberately not done. If
   * someone "fixes" it, this test should be the conversation.
   */
  it('says nothing about a base resolver making several raw calls of its own', async () => {
    const db = { query: async (sql: string) => sql }
    const getOuter = resolver('getOuter', async (_params, scope: { db: typeof db }) => {
      await scope.db.query('SELECT 1')
      await scope.db.query('SELECT 2')
      await scope.db.query('SELECT 3')
      return ok(null)
    })

    await getOuter({}, { db })

    expect(warn).not.toHaveBeenCalled()
  })

  it("lets a thrown body's own error win over a guard complaint", async () => {
    const getA = resolver('getA', async () => ok('a'))
    const getOuter = resolver('getOuter', async (params, scope) => {
      await getA(params, scope)
      throw new Error('the real problem')
    })

    await expect(getOuter({}, createScope({}, { guard: 'error' }))).rejects.toThrow(
      'the real problem'
    )
  })
})
