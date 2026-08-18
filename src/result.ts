/**
 * Anticipated failure is data; exceptions are for bugs. A failure result tells
 * the caller "this won't work, here's why". A thrown error tells the developer
 * "fix this". The wrapper never catches, so the two stay distinct.
 *
 * The error type is deliberately unconstrained. A call might report a structured
 * error, a plain message, an HTTP status, or nothing at all — plenty of
 * unsuccessful paths aren't strictly errors. Whatever a body returns is what the
 * call's error type becomes.
 */

export interface IOk<TOutput = undefined> {
  success: true
  data: TOutput
}

export interface IFail<TError = unknown> {
  success: false
  error?: TError
}

/** Two interfaces rather than one, so checking `success` narrows `data` and `error`. */
export type IResult<TOutput = undefined, TError = unknown> = IOk<TOutput> | IFail<TError>

/**
 * IResult, named for the slot it fills in a resolver's or mutator's function type —
 * both TOutput and TError default independently, so a call's contract or an app's
 * own result alias (like examples/quoin.ts's TAppResult) can fix either one and
 * leave the other open. Named TOutput rather than TData: it's the outer generic on
 * IResolverFn/IMutatorFn/IIterativeResolverFn that means "the whole thing a call
 * returns" and is already called TResult, so this one — the value inside a
 * successful result — needs its own word rather than colliding with that.
 */
export type IResponse<TOutput = unknown, TError = unknown> = IResult<TOutput, TError>

export function ok(): IOk<undefined>
export function ok<TOutput>(data: TOutput): IOk<TOutput>
export function ok<TOutput>(data?: TOutput): IOk<TOutput | undefined> {
  return { success: true, data }
}

export function fail<TError = unknown>(error?: TError): IFail<TError> {
  return { success: false, ...(error !== undefined && { error }) }
}
