import type { IResponse } from 'quoin'

/**
 * Quoin doesn't define an error shape — a call might report a structured error, a
 * message, an HTTP status, or nothing. This is what *this* app decided, and it is
 * the only place that decision lives.
 *
 * Defining one is worth it as soon as callers need to branch: `code` is stable and
 * switchable, where a message is not.
 */
export interface IAppError {
  /** Branch on this, never on the message. */
  code: string
  message: string
  /** Whether trying again could help. */
  retryable?: boolean
  /** The underlying thing that went wrong, when there is one. */
  cause?: unknown
  /**
   * Calls that already took effect before this failure. Composites are not
   * atomic, so a failure with nothing here means nothing happened — and callers
   * rely on that. See composite/user.ts.
   */
  applied?: string[]
}

/**
 * Pin a call's output contract with this rather than letting it be inferred:
 *
 * ```ts
 * async (params: { id: number }, scope: IAppScope): Promise<TAppResult<IUser>> => …
 * ```
 *
 * Leaving it off is fine too — Quoin infers both the data and the error type from
 * whatever the body returns.
 */
export type TAppResult<TOutput = undefined> = IResponse<TOutput, IAppError>
