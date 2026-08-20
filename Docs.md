<img src="./assets/quoin-logo-h-name.svg" height="128" alt="Quoin" />

# Docs

Reference documentation for Quoin, one page per concept. New here: start with
[Quickstart](./docs/quickstart.md). Already know the shape of the thing: use the cheatsheet below.

## Pages

- **[Installation](./docs/installation.md)** - getting Quoin into your project.
- **[Quickstart](./docs/quickstart.md)** - one worked example, start to finish.
- **[Why](./docs/why.md)** - the problem Quoin solves, and how it compares to the alternatives.
- **[Scope](./docs/scope.md)** - `params` / `value` / `scope`, and what `createScope` configures.
- **[Results](./docs/results.md)** - the `ok()`/`fail()` contract every call returns, and when to
  throw instead.
- **[Resolvers](./docs/resolvers.md)** - base reads, and streaming reads with `iterativeResolver`.
- **[Mutators](./docs/mutators.md)** - base writes.
- **[Composites](./docs/composites.md)** - building a call from other calls: the guard, the scope
  rule, atomicity, optimized composites.
- **[Organization](./docs/organization.md)** - laying resolvers and mutators out across files: the
  options, their tradeoffs, and the recommended default.
- **[Metrics](./docs/metrics.md)** - turning on call timing and reading it back.
- **[React](./docs/react.md)** - `QuoinProvider` and the three hooks.

## Cheatsheet

| Export | | |
|---|---|---|
| `resolver(name, fn)` | base read: `(params, scope)` | [Resolvers](./docs/resolvers.md) |
| `compositeResolver(name, fn)` | read built from other resolvers | [Composites](./docs/composites.md) |
| `mutator(name, fn)` | base write: `(params, value, scope)` | [Mutators](./docs/mutators.md) |
| `compositeMutator(name, fn)` | write built from other resolvers/mutators | [Composites](./docs/composites.md) |
| `iterativeResolver(name, fn)` | base read that streams: `(params, scope) => AsyncGenerator` | [Resolvers](./docs/resolvers.md#streaming) |
| `compositeIterativeResolver(name, fn)` | streaming read built from other resolvers | [Composites](./docs/composites.md) |
| `ok(data?)` / `fail(error?)` | results, both arguments optional | [Results](./docs/results.md) |
| `createScope(app, options?)` | scope with the reserved block: `{ guard, metrics }` | [Scope](./docs/scope.md) |
| `QuoinProvider`, `useResolver`, `useMutator`, `useIterativeResolver` | React bindings, `quoin/react` | [React](./docs/react.md) |

All factories return a callable carrying `.info` (`{ name, kind, type }`) and never mutate the
function they were given. `resolver`/`mutator` factories always return a promise, whether the
wrapped function is sync or async. The `iterativeResolver` factories always return an
`AsyncGenerator`.

For a full runnable app instead of snippets, see [`examples/`](./examples), starting with
[`examples/README.md`](./examples/README.md).
