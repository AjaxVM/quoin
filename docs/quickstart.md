# Quickstart

```ts
import { resolver, compositeResolver, createScope, ok, fail } from 'quoin';

// A base resolver: one data artifact.
const getUser = resolver('getUser', async (params: { id: number }, scope: IAppScope) => {
  const row = await findUser(scope.db, params.id);
  return row ? ok(row) : fail({ code: 'USER_NOT_FOUND', message: `User ${params.id} not found` });
});

const getOrders = resolver('getOrders', async (params: { userId: number }, scope: IAppScope) =>
  ok(await findOrders(scope.db, params.userId))
);

// A composite: built from other resolvers, and declared as such.
const getUserWithOrders = compositeResolver(
  'getUserWithOrders',
  async (params: { id: number }, scope: IAppScope) => {
    const user = await getUser({ id: params.id }, scope);
    if (!user.success) {
      return user;
    }

    const orders = await getOrders({ userId: user.data.id }, scope);
    if (!orders.success) {
      return orders;
    }

    return ok({ ...user.data, orders: orders.data });
  }
);

const scope = createScope({ db, apiClient, session });
const result = await getUserWithOrders({ id: 1 }, scope);

if (result.success) {
  render(result.data);
} else {
  showProblem(result.error);
}
```

That's the whole shape: reads are `resolver`s, a read built from other reads is a
`compositeResolver`, every call returns `{ success, data }` or `{ success: false, error }`, and
`scope` carries whatever the calls underneath actually need: connections and clients, but also
things like session or auth details, or any other app-wide context a call might reach for.

Where to go next:

- [Scope](./scope.md) - what `params`/`value`/`scope` mean, and what `createScope` configures.
- [Results](./results.md) - the full `ok()`/`fail()` contract, and when to throw instead.
- [Resolvers](./resolvers.md) / [Mutators](./mutators.md) - the base cases.
- [Composites](./composites.md) - building a call from other calls, and the rules that come with it.

For a full runnable app instead of a snippet, see [`examples/`](../examples).
