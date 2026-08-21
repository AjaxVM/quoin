# Scope

Every resolver and mutator takes the same trailing argument: `scope`, the application context the
call executes within, the scope of its access. Connections, clients, session data, whatever the
calls underneath actually need.

```ts
resolver(name, async (params, scope) => …)
mutator(name, async (params, value, scope) => …)
```

## The three names

- **`params`** - what this call needs to know: an identity for what to act on (`{ id: 7 }`), plus
  whatever configuration or options the call takes: a TTL, which API version to hit, flags,
  whatever the call requires. Pass `null` when the scope already knows, as with a current-user
  lookup.
- **`value`** - what to change about it. This is what separates a mutator from a resolver:
  `updateUserEmail({ id: 7 }, { email: '…' }, scope)` reads as one sentence for that reason.
- **`scope`** - the application context, as above.

All three are positional, so TypeScript never sees these names past the function boundary. A
resolver's own body can call them whatever reads best (`identity`/`args`/`request`, etc.).
`params`/`value`/`scope` is just Quoin's own convention for consistency across the docs and
examples.

## Building one

```ts
type IAppFields = {
  db: DatabaseSync;
  apiClient: IPostsApiClient;
  session: ISession;
};

const scope = createScope<IAppFields>({ db, apiClient, session });
```

`createScope` is optional: a bare `{ db }` is already a valid scope, with every library feature
(the guard, metrics) effectively off. Reach for `createScope` to configure the guard mode or turn
metrics on:

```ts
createScope(app, {
  guard: 'error',   // 'warn' (default) | 'error' | 'off' - see Composites
  metrics: true,    // off by default - see Metrics
});
```

Both are opt-in: turning either on doesn't change a call's shape, only what's recorded or
enforced around it.

Since a scope is just a collection of context or state that is shared across resolvers, you can run as many as makes sense, whether that is one per source, or a fresh one per request.
An important rule applies to scopes passed to a composite: it has to carry everything the whole chain will reach.
See [the composite scope rule](./composites.md#the-composite-scope-rule) for the full rule and its
caveats.
