# Resolvers

```ts
resolver(name: string, fn: (params, scope) => result): IResolver
```

A resolver reads one data artifact: given `params` (an identity plus whatever the call needs to
know) and `scope` (the connections and clients it runs against), it returns a
[result](./results.md): `{ success: true, data }` or `{ success: false, error }`. See
[Scope](./scope.md) for the full `params`/`value`/`scope` picture.

```ts
const getUser = resolver('getUser', async (params: { id: number }, scope: IAppScope) => {
  const row = await findUser(scope.db, params.id);
  return row ? ok(row) : fail({ code: 'USER_NOT_FOUND', message: `User ${params.id} not found` });
});
```

A resolver built from other resolvers instead of touching a source directly is a
`compositeResolver`: same shape, different label. See [Composites](./composites.md).

## Streaming

```ts
iterativeResolver(name: string, fn: (params, scope) => AsyncGenerator<result>): IIterativeResolver
```

A body that yields values over time instead of resolving once (pages, cursors, anything a caller
wants to consume as it arrives) is the same shape again, just returning an `AsyncGenerator`
instead of a single result. Same guard, same metrics: a base iterative resolver calling another
resolver still gets caught, and a call still gets timed. `compositeIterativeResolver` is the
composite half, same as everywhere else.

```ts
const getOrdersByUserIdPaged = iterativeResolver(
  'getOrdersByUserIdPaged',
  async function* (params: { userId: number; pageSize?: number }, scope: IAppScope) {
    // ...yield one page (a result, `TAppResult<IOrder[]>`) at a time; return when done.
  }
);

for await (const page of getOrdersByUserIdPaged({ userId: 1 }, scope)) {
  if (!page.success) break;
  render(page.data);
}
```

One real difference from a regular resolver: the body doesn't run until the caller first pulls a
value from it, same as any JS async generator. Calling `getOrdersByUserIdPaged(...)` alone runs
nothing.

No streaming mutator: a write resolves once by nature.
