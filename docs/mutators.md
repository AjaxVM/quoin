# Mutators

```ts
mutator(name: string, fn: (params, value, scope) => result): IMutator
```

A mutator writes one data artifact. It takes the same `params`/`scope` a resolver does, plus one
addition: **`value`**, what to change `params` to. `params` says what to act on: an identity, plus
whatever else the call needs to know. `value` says what it should become. `scope` is the
connections and clients the write runs against. The return is the same [result](./results.md)
contract as a resolver: `{ success: true, data }` or `{ success: false, error }`. See
[Scope](./scope.md) for more on `params`/`value`/`scope` as a set.

```ts
const setUserEmail = mutator(
  'setUserEmail',
  async (params: { id: number }, value: { email: string }, scope: IAppScope) => {
    const updated = await updateUserRow(scope.db, params.id, { email: value.email });
    return updated
      ? ok(updated)
      : fail({ code: 'USER_NOT_FOUND', message: `User ${params.id} not found` });
  }
);

await setUserEmail({ id: 7 }, { email: 'new@example.com' }, scope);
```

`setUserEmail({ id: 7 }, { email: '…' }, scope)` reads as one sentence for that reason: `params`
identifies, `value` supplies the change.

A mutator built from other resolvers or mutators (or one that reaches multiple different data
artifacts or sources directly in its own implementation) is a `compositeMutator` instead. See
[Composites](./composites.md).
