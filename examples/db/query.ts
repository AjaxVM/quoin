import type { DatabaseSync } from 'node:sqlite'

/**
 * A validating query boundary, so resolvers stop hand-casting raw sqlite output.
 * Shapes describe the SQL result (snake_case, as written in the query); resolvers
 * map that to domain types.
 *
 * Throws rather than returning a result: a column that isn't what was declared
 * means the code and the schema disagree, which is a bug. Absence is different —
 * queryOne returns undefined and lets the resolver decide what that means.
 */

export type TParam = string | number | bigint | null | Uint8Array

export type TColumn<T> = (value: unknown, column: string) => T

export type TShape = Record<string, TColumn<unknown>>

export type TRow<TShapeT extends TShape> = {
  [K in keyof TShapeT]: TShapeT[K] extends TColumn<infer U> ? U : never;
}

/**
 * Named to say it throws. Not to be confused with Quoin's `fail()`, which returns
 * a failure result — the distinction this whole library rests on.
 */
function mismatch(column: string, expected: string, value: unknown): never {
  throw new Error(
    `Column "${column}" expected ${expected}, got ${JSON.stringify(value) ?? typeof value}`
  )
}

export const int: TColumn<number> = (value, column) =>
  typeof value === 'number' && Number.isInteger(value)
    ? value
    : mismatch(column, 'an integer', value)

export const text: TColumn<string> = (value, column) =>
  typeof value === 'string' ? value : mismatch(column, 'text', value)

/** Wraps another column so SQL NULL is allowed — LEFT JOINs need this. */
export const nullable
  = <T>(inner: TColumn<T>): TColumn<T | null> =>
    (value, column) =>
      value === null || value === undefined ? null : inner(value, column)

function check<TShapeT extends TShape>(
  row: Record<string, unknown>,
  shape: TShapeT
): TRow<TShapeT> {
  const checked: Record<string, unknown> = {}
  for (const [column, validate] of Object.entries(shape)) {
    // Checked here rather than left to the column functions: a nullable column
    // can't tell a SQL NULL from one the query never selected, so a typo in a
    // nullable field would quietly become null.
    if (!(column in row)) {
      throw new Error(`Column "${column}" was not returned by the query`)
    }
    checked[column] = validate(row[column], column)
  }
  return checked as TRow<TShapeT>
}

export function queryAll<TShapeT extends TShape>(
  db: DatabaseSync,
  sql: string,
  params: TParam[],
  shape: TShapeT
): TRow<TShapeT>[] {
  const rows = db.prepare(sql).all(...params) as unknown as Record<string, unknown>[]
  return rows.map((row) => check(row, shape))
}

export function queryOne<TShapeT extends TShape>(
  db: DatabaseSync,
  sql: string,
  params: TParam[],
  shape: TShapeT
): TRow<TShapeT> | undefined {
  const row = db.prepare(sql).get(...params) as Record<string, unknown> | undefined
  return row === undefined ? undefined : check(row, shape)
}

export function execute(db: DatabaseSync, sql: string, params: TParam[]): { changes: number } {
  const result = db.prepare(sql).run(...params)
  return { changes: Number(result.changes) }
}
