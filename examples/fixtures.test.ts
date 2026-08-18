import { ok, fail } from 'quoin'
import { assertOk, assertFail } from './fixtures.js'

/**
 * The narrowing helpers the example tests lean on. Their failure messages are what
 * you read when something breaks, so they are worth pinning.
 */
describe('assertOk / assertFail', () => {
  it('pass through the branch they expect', () => {
    expect(() => assertOk(ok(1))).not.toThrow()
    expect(() => assertFail(fail({ code: 'NOPE', message: 'no' }))).not.toThrow()
  })

  it('report the error when a success was expected', () => {
    expect(() => assertOk(fail({ code: 'NOPE', message: 'no' }))).toThrow(
      'Expected success, got failure: {"code":"NOPE","message":"no"}'
    )
  })

  it('report the data when a failure was expected', () => {
    expect(() => assertFail(ok({ id: 1 }))).toThrow('Expected failure, got success: {"id":1}')
  })
})
