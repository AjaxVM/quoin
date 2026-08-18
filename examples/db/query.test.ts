import type { DatabaseSync } from 'node:sqlite'
import { createDb, seed } from './connection.js'
import { SEED } from '../fixtures.js'
import { queryAll, queryOne, execute, int, text, nullable } from './query.js'

describe('validating query boundary', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb()
    seed(db, SEED)
  })

  it('returns rows checked against the declared columns', () => {
    const rows = queryAll(db, 'SELECT id, name FROM users ORDER BY id', [], {
      id: int,
      name: text
    })

    expect(rows).toEqual([
      { id: 1, name: 'Ada Lovelace' },
      { id: 2, name: 'Charles Babbage' }
    ])
  })

  it('returns undefined rather than throwing when nothing matches', () => {
    expect(queryOne(db, 'SELECT id FROM users WHERE id = ?', [999], { id: int })).toBeUndefined()
  })

  it('rejects a column whose type is not what was declared', () => {
    expect(() => queryAll(db, 'SELECT name FROM users', [], { name: int })).toThrow(
      'Column "name" expected an integer'
    )
  })

  it('rejects a column the query did not actually select — the typo case', () => {
    expect(() => queryAll(db, 'SELECT id FROM users', [], { id: int, emial: text })).toThrow(
      'Column "emial" was not returned by the query'
    )
  })

  /** The case nullable would otherwise swallow: a typo becoming a silent null. */
  it('rejects a missing column even when the shape says it may be null', () => {
    expect(() => queryAll(db, 'SELECT id FROM users', [], { id: int, emial: nullable(text) })).toThrow(
      'Column "emial" was not returned by the query'
    )
  })

  it('allows NULL only where the shape says so', () => {
    const [row] = queryAll(
      db,
      'SELECT u.id as id, o.id as order_id FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.id = 2 AND o.id IS NULL',
      [],
      { id: int, order_id: nullable(int) }
    )

    expect(row).toBeUndefined()
  })

  it('nullable passes a present value through to the inner check', () => {
    const [row] = queryAll(db, 'SELECT id, item FROM orders WHERE id = 1', [], {
      id: int,
      item: nullable(text)
    })

    expect(row).toEqual({ id: 1, item: 'Difference Engine plans' })
  })

  it('reports how many rows a write changed', () => {
    expect(execute(db, 'UPDATE users SET email = ? WHERE id = ?', ['x@example.com', 1])).toEqual({
      changes: 1
    })
    expect(execute(db, 'UPDATE users SET email = ? WHERE id = ?', ['x@example.com', 999])).toEqual({
      changes: 0
    })
  })
})
