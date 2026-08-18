import { ok, fail, type IResult } from './result.js'

interface IAppError {
  code: string
  message: string
}

describe('ok / fail', () => {
  it('builds an ok result that narrows on success', () => {
    const result: IResult<number> = ok(42)

    expect(result).toEqual({ success: true, data: 42 })
    if (!result.success) {
      throw new Error('expected success')
    }
    // Narrowed to number, with no second check for undefined.
    expect(result.data.toFixed(0)).toBe('42')
  })

  it('builds a fail result that narrows on failure', () => {
    const error: IAppError = { code: 'NOPE', message: 'not allowed' }
    const result: IResult<number, IAppError> = fail(error)

    expect(result).toEqual({ success: false, error })
    if (result.success) {
      throw new Error('expected failure')
    }
    expect(result.error?.code).toBe('NOPE')
  })

  /** A call that did its job and has nothing to hand back. */
  it('succeeds with no data at all', () => {
    expect(ok()).toEqual({ success: true, data: undefined })
    expect(ok().success).toBe(true)
  })

  /** Plenty of unsuccessful paths aren't errors — refusal needs no object. */
  it('fails with no error at all', () => {
    const result = fail()

    expect(result).toEqual({ success: false })
    expect(Object.keys(result)).toEqual(['success'])
  })

  it('carries no null counterparts — the discriminant already says it', () => {
    expect(Object.keys(ok(1))).toEqual(['success', 'data'])
    expect(Object.keys(fail({ code: 'X', message: 'x' }))).toEqual(['success', 'error'])
  })
})

/**
 * The error type is never declared, only inferred from what a body returns. These
 * assert the inference holds, since it is what lets a call report whatever shape
 * suits it without a generic at the definition site.
 */
describe('error type inference', () => {
  const call = async (fails: boolean): Promise<IResult<number, IAppError>> =>
    fails ? fail({ code: 'NOPE', message: 'no' }) : ok(1)

  it('infers a structured error, not unknown', async () => {
    const result = await call(true)

    if (result.success) {
      throw new Error('expected failure')
    }
    // Typed: .code resolves without narrowing from unknown.
    expect(result.error?.code).toBe('NOPE')
  })

  it('lets a failure propagate without repackaging, whatever its data type', async () => {
    const inner = await call(true)
    if (inner.success) {
      throw new Error('expected failure')
    }

    // IFail carries no data type, so it satisfies a differently-typed result.
    const outer: IResult<string, IAppError> = inner
    expect(outer.success).toBe(false)
  })

  it('accepts an error that is not an object at all', async () => {
    const status = async (): Promise<IResult<number, number>> => fail(404)

    const result = await status()
    if (result.success) {
      throw new Error('expected failure')
    }
    expect(result.error).toBe(404)
  })
})

/**
 * There is no combinator, on purpose. This covers the shape composites use
 * instead: dependent steps, each failure checked where it happens.
 */
describe('the sequential composite shape', () => {
  const step = async (outcome: IResult<number, IAppError>): Promise<IResult<number, IAppError>> =>
    outcome

  it('short-circuits at the first failing step, keeping that step’s error', async () => {
    const failure: IAppError = { code: 'STEP_ONE', message: 'first step failed' }

    const first = await step(fail(failure))
    if (first.success) {
      throw new Error('expected failure')
    }

    expect(first.error).toEqual(failure)
  })

  it('narrows each step’s data for the step that follows it', async () => {
    const first = await step(ok(2))
    if (!first.success) {
      throw new Error('expected success')
    }

    const second = await step(ok(first.data * 3))
    if (!second.success) {
      throw new Error('expected success')
    }
    expect(second.data).toBe(6)
  })
})
