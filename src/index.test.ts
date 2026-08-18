import {
  resolver,
  compositeResolver,
  mutator,
  compositeMutator,
  iterativeResolver,
  compositeIterativeResolver,
  ok,
  fail,
  createScope,
  DEFAULT_CONFIG
} from './index.js'
import type {
  IResolver,
  IMutator,
  IIterativeResolver,
  IInfo,
  TKind,
  TType,
  TScope,
  TGuard,
  IConfig,
  IResult,
  IResponse
} from './index.js'

/**
 * Smoke test on the package entry: constructs one of everything through the
 * surface a consumer actually gets. Cheap, and it catches the class of break where
 * an export names something the module no longer has.
 */
describe('package entry', () => {
  it('exports working factories', async () => {
    const getThing: IResolver<{ id: number }, TScope, IResponse<string>> = resolver(
      'getThing',
      async (params) => ok(`thing ${params.id}`)
    )
    const getBoth = compositeResolver('getBoth', async (params: { id: number }, scope: TScope) =>
      getThing(params, scope)
    )
    const setThing: IMutator<{ id: number }, string, TScope, IResponse<string>> = mutator(
      'setThing',
      async (_params, value) => ok(value)
    )
    const setBoth = compositeMutator(
      'setBoth',
      async (params: { id: number }, value: string, scope: TScope) =>
        setThing(params, value, scope)
    )
    const streamThing: IIterativeResolver<{ id: number }, TScope, IResponse<string>>
      = iterativeResolver('streamThing', async function* (params) {
        yield ok(`thing ${params.id}`)
      })
    const streamBoth = compositeIterativeResolver(
      'streamBoth',
      async function* (params: { id: number }, scope: TScope) {
        yield* streamThing(params, scope)
      }
    )

    const scope = createScope({ db: 'test-db' }, { guard: 'error' })

    await expect(getThing({ id: 1 }, scope)).resolves.toEqual(ok('thing 1'))
    await expect(getBoth({ id: 2 }, scope)).resolves.toEqual(ok('thing 2'))
    await expect(setThing({ id: 1 }, 'written', scope)).resolves.toEqual(ok('written'))
    await expect(setBoth({ id: 1 }, 'written', scope)).resolves.toEqual(ok('written'))

    const streamed: IResponse<string>[] = []
    for await (const value of streamThing({ id: 3 }, scope)) {
      streamed.push(value)
    }
    expect(streamed).toEqual([ok('thing 3')])

    const streamedBoth: IResponse<string>[] = []
    for await (const value of streamBoth({ id: 4 }, scope)) {
      streamedBoth.push(value)
    }
    expect(streamedBoth).toEqual([ok('thing 4')])
  })

  it('exports the result shape and its helpers', () => {
    // The library defines no error shape; this is the app's, declared here.
    interface IAppError {
      code: string
      message: string
    }
    const error: IAppError = { code: 'NOPE', message: 'not allowed' }

    const good: IResult<number> = ok(1)
    const bad: IResult<number, IAppError> = fail(error)
    const empty: IResult = ok()

    expect(good).toEqual({ success: true, data: 1 })
    expect(bad).toEqual({ success: false, error })
    expect(empty).toEqual({ success: true, data: undefined })
    expect(fail()).toEqual({ success: false })
  })

  it('exports the info shape and its kinds', () => {
    const kinds: TKind[] = ['base', 'composite']
    const types: TType[] = ['resolver', 'mutator', 'iterativeResolver']
    const info: IInfo = resolver('getThing', async () => ok(null)).info

    expect(kinds).toContain(info.kind)
    expect(types).toContain(info.type)
  })

  it('exports scope construction and its defaults', () => {
    const guards: TGuard[] = ['off', 'warn', 'error']
    const config: IConfig = DEFAULT_CONFIG
    const scope = createScope({ db: 'test-db' })

    expect(guards).toContain(config.guard)
    expect(config.guard).toBe('warn')
    expect(scope.db).toBe('test-db')
    expect(scope.$quoin?.config).toEqual(DEFAULT_CONFIG)
  })
})
