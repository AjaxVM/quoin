import type { IInfo } from './info.js'

/** What to do when a call declared base ends up calling another. */
export type TGuard = 'off' | 'warn' | 'error'

export interface IConfig {
  guard: TGuard
}

/** A call's node in the chain. Children append themselves as they run. */
export interface IFrame {
  info: IInfo
  /** Root call down to this one: ['getUserProfile', 'getUserById']. */
  path: string[]
  children: IInfo[]
}

export interface IMetric extends IInfo {
  path: string[]
  /** Includes nested calls, so concurrent siblings overlap and won't sum to their parent. */
  durationMs: number
}

export interface IQuoinScope {
  config: IConfig
  /** Absent at the top level. Present means this call came from inside another. */
  frame?: IFrame
  /** Shared down the chain. Its presence switches collection on. */
  metrics?: IMetric[]
}

/**
 * The application context a call executes within — the scope of its access:
 * connections, clients, session. `$quoin` is optional, so a bare `{ db }` works
 * with every feature off.
 *
 * Also the floor every call's scope must satisfy, via its own default: a call's
 * generic scope parameter constrains to the bare `TScope` (`TApp = object`).
 * Constraining to that rather than to a bare `{ $quoin?: … }` matters because a type
 * with only optional properties is *weak*, and TypeScript rejects anything with no
 * property in common with it, which would exclude every real scope. Intersecting
 * with `object` sidesteps that while still rejecting a malformed `$quoin`.
 */
export type TScope<TApp extends object = object> = TApp & {
  $quoin?: IQuoinScope
}

export interface IScopeOptions {
  guard?: TGuard
  /** Off by default — the sink grows for the scope's lifetime. */
  metrics?: boolean
}

export const DEFAULT_CONFIG: IConfig = { guard: 'warn' }

export function createScope<TApp extends object>(
  app: TApp,
  options: IScopeOptions = {}
): TScope<TApp> {
  const $quoin: IQuoinScope = {
    config: { guard: options.guard ?? DEFAULT_CONFIG.guard },
    ...(options.metrics && { metrics: [] })
  }
  return { ...app, $quoin }
}

export interface ICall<TCallScope> {
  /** Hand this to the wrapped function: a copy carrying this call's frame. */
  scope: TCallScope
  /** Timing. Every path, never throws. */
  record: () => void
  /** Guard. Only when the body completed, and it may throw. */
  check: () => void
}

const noop = (): void => {}

function report(guard: TGuard, info: IInfo, children: IInfo[]): void {
  const message
    = `quoin: "${info.name}" is declared base but called `
      + `${children.map((child) => child.name).join(', ')}. `
      + `Use compositeResolver()/compositeMutator().`

  if (guard === 'error') {
    throw new Error(message)
  }
  console.warn(message)
}

/**
 * Threads one call into the chain. Each call gets its own scope copy, so
 * concurrent siblings never see each other's frame and a call behaves the same
 * however it was scheduled.
 */
export function enterCall<TCallScope extends TScope>(
  info: IInfo,
  scope: TCallScope
): ICall<TCallScope> {
  const parent = scope.$quoin
  const config = parent?.config ?? DEFAULT_CONFIG
  const metrics = parent?.metrics

  if (config.guard === 'off' && !metrics) {
    return { scope, record: noop, check: noop }
  }

  parent?.frame?.children.push(info)

  const frame: IFrame = {
    info,
    path: parent?.frame ? [...parent.frame.path, info.name] : [info.name],
    children: []
  }
  const startedAt = performance.now()

  return {
    scope: { ...scope, $quoin: { config, frame, metrics } },
    record: () =>
      metrics?.push({
        ...info,
        path: frame.path,
        durationMs: performance.now() - startedAt
      }),
    check: () => {
      if (info.kind === 'base' && frame.children.length > 0) {
        report(config.guard, info, frame.children)
      }
    }
  }
}

/**
 * Runs a wrapped body through one call: derives the call's scope, times it via
 * try/finally so a thrown body's own error and stack propagate untouched instead of
 * being caught and rethrown, and reports the guard once the body completes — never
 * on a throw, since a thrown error is a bug that wins outright over a guard complaint.
 */
export async function runCall<TCallScope extends TScope, TResult>(
  info: IInfo,
  scope: TCallScope,
  fn: (scope: TCallScope) => TResult | Promise<TResult>
): Promise<TResult> {
  const call = enterCall(info, scope)
  try {
    const result = await fn(call.scope)
    call.check()
    return result
  } finally {
    call.record()
  }
}

/**
 * Same shape as `runCall`, for a body that streams rather than resolves once:
 * `yield*` delegates every value through untouched, and a mid-stream throw skips
 * `check()` (nothing "completed") while still hitting `record()` from `finally`,
 * then propagates unaltered.
 *
 * `enterCall` — and so the guard's child-tracking — doesn't run until the returned
 * generator is first pulled from: calling an async generator function never runs any
 * of its body up front, only `.next()` does. A caller that constructs the generator
 * without iterating it never registers a call at all.
 */
export async function* runIterativeCall<TCallScope extends TScope, TResult>(
  info: IInfo,
  scope: TCallScope,
  fn: (scope: TCallScope) => AsyncGenerator<TResult, void>
): AsyncGenerator<TResult, void> {
  const call = enterCall(info, scope)
  try {
    yield* fn(call.scope)
    call.check()
  } finally {
    call.record()
  }
}
