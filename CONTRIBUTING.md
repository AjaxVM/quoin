# Contributing to Quoin

Conventions for this repo. This file is the single source of truth for them: `README.md` and
`CLAUDE.md` link here rather than restating anything.

## AI-assisted development

AI-assisted implementation is used throughout this repo, and welcome from contributors. The
condition: a human directs it. Design and pattern decisions come from a person, not a model, and
whoever opens a PR owns everything in it: you should be able to explain any line you submit,
AI-written or not. If a PR is substantially AI-generated, say so; that's an expectation of honesty
about process, not a gate.

## Type naming

**`T` for simple types, `I` for interfaces and complex types.**

| Prefix | Use for | Examples |
|---|---|---|
| `T` | simple type aliases: unions, primitives, generic parameters | `TKind`, `TParams`, `TResult`, `TScope` |
| `I` | interfaces, and type aliases whose shape is complex: function types, intersections | `IInfo`, `IResolver`, `IMutator`, `IResolverFn`, `IAppScope` |

The split is about the shape, not the declaration keyword: `IResolverFn` is a `type`, but a function
signature is a complex shape, so it takes `I`.

## Parameters

`params` is what this call needs to know: an identity for what to act on, plus whatever
configuration or options the call takes (a TTL, a force/cacheOnly flag, whatever the call
requires). `value` is what to change about it, and is what separates a mutator from a resolver.
`scope` is the application context a resolver executes within, the scope of its access:
connections, clients, session.

`params`/`TParams` is Quoin's own canonical term for the slot, used in its types and docs, but
each resolver or mutator's own body is free to name its actual parameter whatever reads best
(`identity`, `args`, `request`, …). TypeScript never sees that name past the function boundary, so
this is a convention for consistency across the example suite, not something enforced.

A resolver's scope must hold everything it *and everything it calls* will reach; several scopes are
fine as long as that holds.

## Structure

- `src/`: the library. Nothing here imports from `examples/`.
- `examples/`: runnable, tested demonstrations of the usage pattern. The usage pattern *is* the
  library's main product, so examples are held to the same standard as `src/`.

### How resolvers are laid out

```
examples/
  db/, api/            sources — connections, query helper, HTTP client
  resolvers/
    base/user.ts       resolvers and mutators over one source
    base/order.ts
    composite/user.ts  resolvers and mutators built out of other resolvers
  scope.ts             the app-wide scope everything is threaded through
```

This is the layout we've settled on, not a rule to follow: one file per resolver, or per data
source, would work just as well.

- **One file per entity group, not per resolver.** `base/user.ts` holds every base user resolver
  *and* mutator; `composite/user.ts` holds the composite ones. `user.ts` existing at both levels is
  the point: it shows at a glance how the entity's resolvers build up.
- **`base/` and `composite/` are separate directories** so a resolver's shape is visible from its
  path before you open it.
- **Composites import what they call directly** — base resolvers or other composites. What a
  composite composes is part of its implementation, not a dependency handed in. Don't reach for
  injection to make a composite reusable across environments; write the environment's own bases and
  its own composites over them.
- **Sources hold no resolvers and no composition.** They may return results where their
  failures are anticipated, and should throw on what is a bug: compare `api/client.ts`, where an
  HTTP 500 is expected traffic, with `db/query.ts`, where a row not matching its declared columns
  means the code and the schema disagree.

## Imports

- **Relative imports carry the `.js` extension**: `import { enterCall } from './scope.js'`. Native
  ESM does no extension guessing, so the suffix is what keeps the emitted package loadable outside a
  bundler.
- **Examples import the library by name** (`import { resolver } from 'quoin'`), so they demonstrate
  the surface a consumer gets rather than reaching into `src/`. Keep the `tsconfig.json` path and the
  `jest.config.js` alias in sync.

## Code style

- The public surface is small on purpose. Prefer adding to an existing factory over introducing a
  new concept.
- Comment the *why*, not the *what*, unless the what is genuinely hard to read.
- Don't add a wrapper (getter, setter, thin pass-through) unless it earns its place. A maintainer
  should be able to tell what code does by reading it, and should need to open as few files as
  possible to understand a system.
- When a lint rule is wrong for a line, say so rather than reshaping the code around it:
  `// eslint-disable-next-line <rule> -- reason`.

## Checks

```
npm run typecheck          # tsc --noEmit across src/ and examples/
npm run typecheck:browser  # tsc --noEmit over src/ only, DOM lib, no node/jest types
npm run lint                # eslint — correctness and style
npm test                    # jest
npm run build                # tsc -p tsconfig.build.json (library only)
npm run lint:fix             # eslint . --fix
```

`typecheck`, `lint`, and `test` should pass before a change is considered done, and a husky pre-push
hook runs them: commits stay cheap, and the gate sits where work leaves the machine. It only ever
*checks*, never fixes. `typecheck:browser` isn't in that hook (`examples/` is Node-only and isn't
what it's checking) but does run in CI: it's what actually backs `src/`'s claim of running
unmodified in a browser, rather than that claim resting on nobody having imported a Node API yet.

`npm run lint --fix` does **not** work: npm swallows the flag rather than forwarding it. Use
`npm run lint -- --fix`, or the `lint:fix` script.
