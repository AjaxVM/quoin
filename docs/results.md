# Results

Every call resolves to a result:

```ts
interface IOk<TOutput>   { success: true;  data: TOutput }
interface IFail<TError> { success: false; error?: TError }
```

Three keys, nothing else. Build them with `ok(data)` and `fail(error)`. Both arguments are
optional, so `ok()` covers a call with nothing to hand back and `fail()` covers a plain refusal.
Checking `success` narrows, so `data` is present and typed in the branch where it exists:

```ts
const getUser = resolver('getUser', async (params: { id: number }, scope: IAppScope) => {
  const row = await findUser(scope.db, params.id);
  return row ? ok(row) : fail({ code: 'USER_NOT_FOUND', message: `User ${params.id} not found` });
});
```

**Errors are just another form of output, and just as user-defined.** Every resolver, mutator, and
iterative resolver takes `TOutput` and `TError` as generic slots the implementation fills in:
`data`'s shape isn't fixed by Quoin, and neither is `error`'s. A call might report a structured
error, a message, an HTTP status, or nothing at all. Plenty of unsuccessful paths aren't strictly
errors.

Defining an error shape for your app is worth it as soon as callers need to branch: a `code` to
switch on, a human message, maybe `retryable` or what a partial failure already applied.
`examples/quoin.ts` shows a concrete one, `IAppError`, along with a `TAppResult` alias that pins it
as the default error type so individual resolvers don't have to name it themselves.

## Fail, or throw?

The split between failing and throwing is by audience:

| | addressed to | means |
|---|---|---|
| `fail(...)` | the caller | "what you're trying to do won't work, here's why" |
| a thrown error | the developer | "there's a bug here that needs fixing" |

An API returning 500 is expected traffic, so it's a `fail`. A database row whose columns don't
match the schema is a bug, so it throws. The wrapper never catches. Catching would merge those two
and silence the second.
