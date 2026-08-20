<img src="./assets/quoin-logo-h-name.svg" height="128" alt="Quoin" />

**A pattern for modelling and composing data access, exposed as a library.**

> A quoin is the dressed stone at a building's corner, the piece that squares everything else up.

Data access grows messier as an application scales: every new source and integration adds to a
maintenance burden that compounds over time. *Quoin* is the pattern I use to keep it uniform.
Every read and write follows the same form, and complex results are built by composing simpler
ones.

Quoin declares one functional interface across data access and keeps it procedural, a call runs
exactly as invoked, nothing hidden, nothing implied. That's what keeps access DRY,
consistent, and composable. A wide result is built by stacking narrower ones instead of reimplementing them - the
narrow ones get written once, and every resolver and mutator shares the same shape. It holds even
under optimization, reaching a source directly for speed still declares the same interface as the
composed version it replaces.

The full case for it, and how it compares to other approaches, is in [Why](./docs/why.md).

## The whole thing in one example

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

## Install

```
npm install quoin
```

Full instructions (React's optional peer dependency, Node version, the not-yet-published caveat):
[Installation](./docs/installation.md). New to Quoin: start with [Quickstart](./docs/quickstart.md).

## Concepts

- **[Resolvers](./docs/resolvers.md)** - reads. `(params, scope) => result`. Includes streaming
  reads (`iterativeResolver`).
- **[Mutators](./docs/mutators.md)** - writes. `(params, value, scope) => result`.
- **[Composites](./docs/composites.md)** - a call built from other calls, declared as such: the
  guard, the scope rule, why composite mutators aren't atomic, optimized composites.
- **[Scope](./docs/scope.md)** - what `params`/`value`/`scope` mean, and what `createScope`
  configures.
- **[Results](./docs/results.md)** - the `ok()`/`fail()` contract every call returns.
- **[Metrics](./docs/metrics.md)** - turning on call timing and reading it back.
- **[React](./docs/react.md)** - `QuoinProvider` and the three hooks.

Full reference index: please read the [Docs](./Docs.md).

## Examples

[`examples/`](./examples) is a runnable, tested app rather than snippets: in-memory sqlite and a
real local HTTP server, no mocks of the library itself - backend resolvers/composites, an HTTP
server exposing some of them, a browser-side client mirroring the same shape over `fetch`, and
React bindings on both sides.

```
npm install
npm test
```

See [`examples/README.md`](./examples/README.md) for how to run each piece, including the no-build
HTML page that loads `dist/` straight into a browser. How resolvers are laid out across files is a
separate question from the call shape itself: see [Organization](./docs/organization.md) for the
options and tradeoffs.

## Porting this

This is an idea as much as an implementation. If you want it in Go, Python, or Rust, please take
it.
The TypeScript package here is small on purpose, and most of what matters is the pattern rather than the code.

MIT licensed. A link back to this repo is appreciated, and I'd love contributions of any improvements back to this project!

## Contributing

Conventions (including where AI-assisted implementation fits) are in
[CONTRIBUTING.md](./CONTRIBUTING.md). Licensed [MIT](./LICENSE).
