import { jest } from '@jest/globals'
import { iterativeResolver, compositeIterativeResolver } from './iterative-resolver.js'
import { resolver } from './resolver.js'
import { ok, fail } from './result.js'
import { createScope } from './scope.js'

async function collect<T>(gen: AsyncGenerator<T, void>): Promise<T[]> {
  const values: T[] = []
  for await (const value of gen) {
    values.push(value)
  }
  return values
}

describe('iterativeResolver', () => {
  it('tags the wrapped function with an info object', () => {
    const streamThings = iterativeResolver('streamThings', async function* () {
      yield ok('value')
    })

    expect(streamThings.info).toEqual({ name: 'streamThings', kind: 'base', type: 'iterativeResolver' })
  })

  it('tags a composite iterative resolver with kind "composite"', () => {
    const streamComposite = compositeIterativeResolver('streamComposite', async function* () {
      yield ok('value')
    })

    expect(streamComposite.info).toEqual({
      name: 'streamComposite',
      kind: 'composite',
      type: 'iterativeResolver'
    })
  })

  it('does not mutate the function it was given', () => {
    const inner = async function* (): AsyncGenerator<never, void> {}
    const streamThings = iterativeResolver('streamThings', inner)

    expect(streamThings).not.toBe(inner)
    expect(inner).not.toHaveProperty('info')
  })

  it(
    'passes the exact params through, and a scope carrying the app fields plus $quoin',
    async () => {
      const inner = jest.fn(async function* (params: { id: number }, scope: { db: string }) {
        yield ok({ id: params.id, source: scope.db })
      })
      const streamThings = iterativeResolver('streamThings', inner)
      const params = { id: 1 }

      await collect(streamThings(params, { db: 'test-db' }))

      expect(inner).toHaveBeenCalledTimes(1)
      const [passedParams, passedScope] = inner.mock.calls[0] as [
        unknown,
        Record<string, unknown>
      ]
      expect(passedParams).toBe(params)
      expect(passedScope.db).toBe('test-db')
      expect(passedScope.$quoin).toMatchObject({
        frame: { info: streamThings.info, children: [] }
      })
    }
  )

  it('hands the caller’s own scope straight through when the guard is off', async () => {
    const inner = jest.fn(async function* (_params: unknown, _scope: unknown) {
      yield ok('value')
    })
    const streamThings = iterativeResolver('streamThings', inner)
    const scope = createScope({ db: 'test-db' }, { guard: 'off' })

    await collect(streamThings({}, scope))

    expect(inner.mock.calls[0][1]).toBe(scope)
  })

  it('yields every value from the inner generator, in order', async () => {
    const streamThings = iterativeResolver('streamThings', async function* () {
      yield ok(1)
      yield ok(2)
      yield ok(3)
    })

    await expect(collect(streamThings({}, {}))).resolves.toEqual([ok(1), ok(2), ok(3)])
  })

  it('can yield a failure result without throwing', async () => {
    const error = { code: 'PAGE_FAILED', message: 'page failed' }
    const streamThings = iterativeResolver('streamThings', async function* () {
      yield ok(1)
      yield fail(error)
    })

    await expect(collect(streamThings({}, {}))).resolves.toEqual([
      ok(1),
      { success: false, error }
    ])
  })

  it('still propagates a thrown error mid-stream — that is a bug, not a result', async () => {
    const streamThings = iterativeResolver('streamThings', async function* () {
      yield ok(1)
      throw new Error('genuine defect')
    })

    const gen = streamThings({}, {})
    await expect(gen.next()).resolves.toEqual({ value: ok(1), done: false })
    await expect(gen.next()).rejects.toThrow('genuine defect')
  })

  it("can call other resolvers from within a composite iterative resolver's body", async () => {
    const getA = resolver('getA', async () => ok('a'))
    const streamBoth = compositeIterativeResolver(
      'streamBoth',
      async function* (params: unknown, scope: object) {
        yield await getA(params, scope)
      }
    )

    await expect(collect(streamBoth({}, {}))).resolves.toEqual([ok('a')])
  })
})

describe('iterative resolver composition guard', () => {
  const silenceWarnings = () => jest.spyOn(console, 'warn').mockImplementation(() => {})
  let warn: ReturnType<typeof silenceWarnings>

  beforeEach(() => {
    warn = silenceWarnings()
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('warns when a base iterative resolver calls another resolver', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const streamOuter = iterativeResolver(
      'streamOuter',
      async function* (params: unknown, scope: object) {
        yield await getA(params, scope)
      }
    )

    await collect(streamOuter({}, {}))

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('"streamOuter" is declared base but called getA')
  })

  it('stays quiet for a composite, however deep the chain', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const streamMiddle = compositeIterativeResolver(
      'streamMiddle',
      async function* (params: unknown, scope: object) {
        yield await getA(params, scope)
      }
    )

    await collect(streamMiddle({}, {}))

    expect(warn).not.toHaveBeenCalled()
  })

  it('rejects instead of warning when the guard is set to "error"', async () => {
    const getA = resolver('getA', async () => ok('a'))
    const streamOuter = iterativeResolver(
      'streamOuter',
      async function* (params: unknown, scope: object) {
        yield await getA(params, scope)
      }
    )
    const scope = createScope({}, { guard: 'error' })

    const gen = streamOuter({}, scope)
    await expect(gen.next()).resolves.toEqual({ value: ok('a'), done: false })
    await expect(gen.next()).rejects.toThrow('"streamOuter" is declared base but called getA')
    expect(warn).not.toHaveBeenCalled()
  })

  it("lets a thrown body's own error win over a guard complaint", async () => {
    const getA = resolver('getA', async () => ok('a'))
    const streamOuter = iterativeResolver(
      'streamOuter',
      // eslint-disable-next-line require-yield -- throws before ever reaching a yield
      async function* (params: unknown, scope: object) {
        await getA(params, scope)
        throw new Error('the real problem')
      }
    )

    const gen = streamOuter({}, createScope({}, { guard: 'error' }))
    await expect(gen.next()).rejects.toThrow('the real problem')
  })
})
