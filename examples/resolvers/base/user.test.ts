import { ok } from 'quoin'
import { getUserById, setUserEmail } from './user.js'
import { createTestScope, assertOk, assertFail } from '../../fixtures.js'
import type { IAppScope } from '../../scope.js'

const ADA = { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' }

describe('base user calls', () => {
  let scope: IAppScope

  beforeEach(() => {
    scope = createTestScope()
  })

  it('are all declared base', () => {
    expect(getUserById.info).toEqual({ name: 'getUserById', kind: 'base', type: 'resolver' })
    expect(setUserEmail.info).toEqual({ name: 'setUserEmail', kind: 'base', type: 'mutator' })
  })

  it('getUserById resolves a seeded user', async () => {
    await expect(getUserById({ id: 1 }, scope)).resolves.toEqual(ok(ADA))
  })

  it('getUserById returns a failure — not a throw — for a missing user', async () => {
    const result = await getUserById({ id: 999 }, scope)

    assertFail(result)
    expect(result.error).toEqual({
      code: 'USER_NOT_FOUND',
      message: 'User 999 not found'
    })
  })

  /** Nothing to hand back, so it succeeds with no data. */
  it('setUserEmail writes the change and succeeds with no data', async () => {
    await expect(setUserEmail({ id: 1 }, { email: 'ada@newmail.com' }, scope)).resolves.toEqual(
      ok()
    )

    const reread = await getUserById({ id: 1 }, scope)
    assertOk(reread)
    expect(reread.data).toMatchObject({ email: 'ada@newmail.com' })
  })

  it('setUserEmail fails rather than silently writing nothing for a missing user', async () => {
    const result = await setUserEmail({ id: 999 }, { email: 'nobody@example.com' }, scope)

    assertFail(result)
    expect(result.error).toMatchObject({ code: 'USER_NOT_FOUND' })
  })
})
