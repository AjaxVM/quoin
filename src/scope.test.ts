import { resolver, compositeResolver } from './resolver.js'
import { mutator } from './mutator.js'
import { iterativeResolver } from './iterative-resolver.js'
import { ok, fail } from './result.js'
import { createScope, DEFAULT_CONFIG, type IMetric } from './scope.js'

describe('createScope', () => {
  it('keeps the app fields and adds the reserved block', () => {
    const db = { name: 'test-db' }
    const scope = createScope({ db, apiClient: 'client' })

    expect(scope.db).toBe(db)
    expect(scope.apiClient).toBe('client')
    expect(scope.$quoin?.config).toEqual(DEFAULT_CONFIG)
  })

  it('collects no metrics unless asked', () => {
    expect(createScope({}).$quoin?.metrics).toBeUndefined()
    expect(createScope({}, { metrics: true }).$quoin?.metrics).toEqual([])
  })
})

describe('metrics', () => {
  const paths = (metrics: IMetric[]): string[] => metrics.map((m) => m.path.join(' > '))

  it('records nothing when the scope has no sink', async () => {
    const getThing = resolver('getThing', async () => ok('value'))
    const scope = createScope({})

    await getThing({}, scope)

    expect(scope.$quoin?.metrics).toBeUndefined()
  })

  it('records one entry per call, with its path through the chain', async () => {
    const getUser = resolver('getUser', async () => ok({ id: 1 }))
    const getOrders = resolver('getOrders', async () => ok([]))
    const getUserWithOrders = compositeResolver('getUserWithOrders', async (params, scope) => {
      await Promise.all([getUser(params, scope), getOrders(params, scope)])
      return ok(null)
    })
    const scope = createScope({}, { metrics: true })

    await getUserWithOrders({}, scope)

    expect(paths(scope.$quoin!.metrics!).sort()).toEqual([
      'getUserWithOrders',
      'getUserWithOrders > getOrders',
      'getUserWithOrders > getUser'
    ])
  })

  it('accumulates across separate calls on the same scope', async () => {
    const getThing = resolver('getThing', async () => ok('value'))
    const scope = createScope({}, { metrics: true })

    await getThing({}, scope)
    await getThing({}, scope)

    expect(scope.$quoin?.metrics).toHaveLength(2)
  })

  it('still times a call whose body returns a failure', async () => {
    const getThing = resolver('getThing', async () =>
      fail({ code: 'NOT_FOUND', message: 'not found' })
    )
    const scope = createScope({}, { metrics: true })

    await getThing({}, scope)

    const [metric] = scope.$quoin!.metrics!
    expect(metric).toMatchObject({ name: 'getThing', kind: 'base' })
    expect(metric.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('still times a call that throws', async () => {
    const getThing = resolver('getThing', async () => {
      throw new Error('genuine defect')
    })
    const scope = createScope({}, { metrics: true })

    await expect(getThing({}, scope)).rejects.toThrow('genuine defect')

    expect(scope.$quoin!.metrics![0]).toMatchObject({ name: 'getThing' })
  })

  it('carries the kind through, so an optimized composite can be compared to the plain one', async () => {
    const getUser = resolver('getUser', async () => ok({ id: 1 }))
    const plain = compositeResolver('plain', async (params, scope) => getUser(params, scope))
    const optimized = compositeResolver('optimized', async () => ok({ id: 1 }))
    const scope = createScope({}, { metrics: true })

    await plain({}, scope)
    await optimized({}, scope)

    const roots = scope.$quoin!.metrics!.filter((m) => m.path.length === 1)
    expect(roots.map((m) => [m.name, m.kind])).toEqual([
      ['plain', 'composite'],
      ['optimized', 'composite']
    ])
  })

  it('still records when the guard is off', async () => {
    const getThing = resolver('getThing', async () => ok('value'))
    const scope = createScope({}, { guard: 'off', metrics: true })

    await getThing({}, scope)

    expect(scope.$quoin?.metrics).toHaveLength(1)
  })

  it('covers mutators too', async () => {
    const setThing = mutator('setThing', async (_params, value) => ok(value))
    const scope = createScope({}, { metrics: true })

    await setThing({}, 'written', scope)

    expect(scope.$quoin!.metrics![0]).toMatchObject({ name: 'setThing' })
  })

  /**
   * An async generator's body never runs until first pulled, so entering the call
   * — and recording it — waits on that too, then only completes once the stream is
   * fully drained rather than after the first yield.
   */
  it('does not record an iterative call until pulled from, and only once fully drained', async () => {
    const streamThing = iterativeResolver('streamThing', async function* () {
      yield ok('value')
    })
    const scope = createScope({}, { metrics: true })
    const gen = streamThing({}, scope)

    expect(scope.$quoin?.metrics).toHaveLength(0)

    await gen.next()
    expect(scope.$quoin?.metrics).toHaveLength(0)

    await gen.next()
    expect(scope.$quoin!.metrics!).toHaveLength(1)
    expect(scope.$quoin!.metrics![0]).toMatchObject({ name: 'streamThing' })
  })
})

describe('degraded scopes', () => {
  it('works with a plain object that has no reserved block', async () => {
    const getThing = resolver('getThing', async (_params, scope: { db: string }) => ok(scope.db))

    await expect(getThing({}, { db: 'test-db' })).resolves.toEqual(ok('test-db'))
  })

  it('leaves the caller’s scope object untouched', async () => {
    const getThing = resolver('getThing', async () => ok('value'))
    const scope = createScope({ db: 'test-db' }, { metrics: true })
    const before = { ...scope.$quoin }

    await getThing({}, scope)

    expect(scope.$quoin?.frame).toBeUndefined()
    expect(scope.$quoin?.config).toEqual(before.config)
  })
})
