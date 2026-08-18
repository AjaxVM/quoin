<img src="./assets/quoin-logo-h-name.svg" height="128" alt="Quoin" />

**A pattern for modelling and composing data access, exposed as a library.**

Data access grows messier as an application scales: every new source and integration adds to a
maintenance burden that compounds over time. *Quoin* is the pattern I use to keep it uniform.
Every read and write follows the same form, and complex results are built by composing simpler
ones.

> A quoin is the dressed stone at a building's corner, the piece that squares everything else up.

Quoin is built on one primitive — the resolver — and everything else augments it. A **mutator**
is a resolver that changes data instead of only returning it. A **composite** is a resolver that
composes access to multiple data points instead of one. An **iterative resolver** carries a
different contract — a stream instead of a single result — but the same core interface.

## Why

That maintenance burden shows up as the same handful of symptoms.

**TODO:** THis text is not quite what I'd write, need's a human editor pass:

Some functions take a connection, some close over one. Some are `findUser`, some `getUserRow`, some `loadUserWithOrders`.
When an endpoint gets slow there's no way to ask which part is slow, because there are no parts.
And failure handling ends up ad hoc: some paths throw, some return null, and callers guess.

Quoin makes the layer uniform enough to reason about:

- **One shape.** `(params, scope)` for reads, `(params, value, scope)` for writes.
- **Anticipated failure is data.** A 404, a permission denial, an API outage: those come back as
  values, not exceptions each caller must remember to catch.
- **Composition is declared.** A call either touches one data artifact directly or composes other
  calls. The library tells you when the two disagree.
- **The chain is observable.** Turn metrics on and every call is timed and attributed to its
  position, so "the profile endpoint is slow" becomes "`getPostsByUserId` is slow".

**TODO:** This should also get a human rewrite, the focus here should be on the fact this is encouraging functional programming patterns with a procedural, reproduceable flow
No registry, no DI container. Things are created and passed in, and operate on what they were
passed.

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

## Porting this

This is an idea as much as an implementation. If you want it in Go, Python, or Rust, please take
it. The TypeScript package here is small on purpose, and most of what matters is decisions rather
than code.

MIT licensed. A link back to this repo is appreciated, and I'd love contributions of any improvements back to this project!

## Parameters

```ts
resolver(name, async (params, scope) => …)
mutator(name, async (params, value, scope) => …)
```

**`params`** is what this call needs to know: an identity for what to act on (`{ id: 7 }`), plus
whatever configuration or options the call takes: a TTL, which API version to hit, a
force/cacheOnly flag, whatever the call requires (see the cache example for one that leans on
several of these at once). Pass `null` when the scope already knows, as with a current-user
lookup. This is Quoin's own canonical name for the slot; each resolver or mutator's body is free
to name its actual parameter whatever reads best (`identity`, `args`, `request`, …), and nothing
past the function boundary sees that name.

**`value`** is what to change about it, and is what separates a mutator from a resolver.
`updateUserEmail({ id: 7 }, { email: '…' }, scope)` reads as one sentence for that reason.

**`scope`** is the application context a resolver executes within, the scope of its access:
session info, data connectors (db clients, api clients, etc.), and whatever else your resolvers
need.

```ts
type IAppFields = {
  db: DatabaseSync;
  apiClient: IPostsApiClient;
  session: ISession;
};

const scope = createScope<IAppFields>({ db, apiClient, session });
```

Nothing stops you having several scopes: one per source, or a fresh one per request. The rule is
that a resolver's scope must hold everything it *and everything it calls* will reach. A composite
spanning the DB and an API needs both present, or it breaks. One app-wide scope is the cheapest way
to never get that wrong.

`createScope` is optional. A bare `{ db }` is a valid scope with every library feature off; use
`createScope` to configure the guard or collect metrics.

## Results

Every call resolves to a result:

```ts
interface IOk<TOutput>   { success: true;  data: TOutput }
interface IFail<TError> { success: false; error?: TError }
```

Three keys, nothing else. Build them with `ok(data)` and `fail(error)`; both arguments are
optional, so `ok()` covers a call with nothing to hand back and `fail()` covers a plain refusal.
Checking `success` narrows, so `data` is present and typed in the branch where it exists.

**Quoin does not define an error shape.** A call might report a structured error, a message, an HTTP
status, or nothing at all. Plenty of unsuccessful paths aren't strictly errors. Whatever a body
returns becomes that call's error type, inferred, with no generic at the definition site.

Defining one for your app is worth it as soon as callers need to branch: a `code` to switch on, a
human message, maybe `retryable` or what a partial failure already applied. `examples/quoin.ts`
shows a concrete one, `IAppError`, along with a `TAppResult` alias that pins it as the default error
type so individual resolvers don't have to name it themselves.

The split between failing and throwing is by audience:

| | addressed to | means |
|---|---|---|
| `fail(...)` | the caller | "what you're trying to do won't work, here's why" |
| a thrown error | the developer | "there's a bug here that needs fixing" |

An API returning 500 is expected traffic, so it's a `fail`. A database row whose columns don't match
the schema is a bug, so it throws. The wrapper never catches. Catching would merge those two and
silence the second.

## Base vs. composite

A composite isn't a different mechanism. It's the same shape with a different label. The factories
are separate only so the label can't be forgotten:

| | reads | writes |
|---|---|---|
| touches one data artifact | `resolver` | `mutator` |
| calls other resolvers/mutators | `compositeResolver` | `compositeMutator` |

Every call carries its label: `getUserWithOrders.info` → `{ name, kind: 'composite' }`.

A composite's own calls don't have to be base themselves — a composite can call other composites
just as easily, layering a wide result out of narrower composed ones instead of reimplementing what
they already do. The guard doesn't care which; it only ever watches for a *base* resolver making
that jump.

Mislabelling is the easy mistake — a base resolver quietly grows a call to another resolver. Quoin
notices:

```ts
const getProfile = resolver('getProfile', async (params: { id: number }, scope: IAppScope) => {
  const user = await getUser(params, scope);   // this makes it a composite
  return user.success ? ok(decorate(user.data)) : user;
});

// quoin: "getProfile" is declared base but called getUser.
//        Use compositeResolver()/compositeMutator().
```

Set the response when you build the scope, choosing `'warn'` (default), `'error'`, or `'off'`:

```ts
createScope({ db }, { guard: 'error' });
```

It reports after the body finishes, so the work takes effect before anything is raised, and a
failing body's own error always wins.

Each call hands its inner function a derived scope carrying that call's frame, so a nested call
arrives already knowing its parent. Call-chain tracking lives entirely in that derived scope, not
in any state outside it. A call's behaviour is fully determined by what it's given: it behaves the
same whether or not it ran inside a `Promise.all`, and concurrent siblings are never attributed to
each other.

The guard sees calls *between* resolvers, not what happens inside one. A base resolver can make as
many raw calls as it needs, as long as they're all in service of the one data artifact it's defined
around: a transaction wrapper around a single upsert, a retry, a config toggle, whatever the call
requires. It stops being base the moment those calls reach separate data artifacts (a user row and
a permissions row from the same database, say), even when that still happens through one raw call.
The guard can't see that distinction either way: it only tracks calls to other Quoin resolvers, so a
body's internal calls are invisible to it regardless of what they touch. Declaring correctly is on
you: Quoin doesn't define how small "one data artifact" is for your domain.

### Composites are not atomic

A composite mutator that writes and then calls something that fails has **partially applied**: the
write stands. That follows from what a composite actually is. A resolver or mutator counts as
composite the moment its own implementation touches more than one data artifact — not only when it
calls other resolvers to do so, but also when it reaches multiple artifacts directly in a call of
its own, say a SQL join across tables it queries itself. Composing calls to separate resolvers is
simply the common way to build one. Each call is its own operation, succeeding or failing
independently, with nothing tying them together: a composite built this way only knows the
interface of what it calls, never the implementation.

An **optimized** composite is still a composite by that same definition: it touches the same
multiple artifacts, just reached directly in its own query or transaction rather than through calls
to other resolvers — one query standing in for what several resolver calls would otherwise do, same
shape and effect, just a more complex implementation underneath. Because it's the one reaching the
artifacts itself, it's also the one place atomicity becomes available: wrap that direct reach in a
transaction (or use an endpoint that's already atomic) and the composite is atomic. A composite
built by calling other resolvers can't do that; it never has direct access to wrap.

A single call to a purpose-built endpoint that already returns a joined shape looks similar from the
outside, but isn't this: the joining happened on the far side of a call this resolver doesn't
control, so from here it's one artifact from one source — base, not composite, no matter how much
composing produced that artifact upstream. [Optimized composites](#optimized-composites) below has
the full local-vs-remote distinction.

A base resolver never runs into the atomicity question at all. Touching exactly one artifact —
whatever shape it arrives in — there's nothing to coordinate.

Whether to stop, roll forward, or compensate is that composite's business. Reporting accurately
isn't optional:

```ts
const written = await setUserEmail(params, value, scope);
if (!written.success) return written;                    // nothing applied

const sent = await sendConfirmation(params, value, scope);
if (!sent.success) {
  // The email did change. Say so: a bare failure reads as "nothing happened".
  return fail({
    code: 'CONFIRMATION_FAILED',
    message: 'Email updated but the confirmation could not be sent',
    cause: sent.error,
    applied: [setUserEmail.info.name],
  });
}
```

Each step is checked where it happens, because that's the only place that knows what the composite
had already done by then. A failure with no `applied` means nothing landed, and callers rely on
that, so a mutating composite has to keep that promise deliberately.

For independent calls, fan out and check each. You keep which one failed:

```ts
const [user, posts] = await Promise.all([
  getUser({ id }, scope),
  getPosts({ userId: id }, scope),
]);
if (!user.success) return user;
if (!posts.success) return posts;
```

A call site can do exactly the same thing when it wants several resolvers at once.

## Streaming

A body that yields values over time instead of resolving once (pages, cursors, anything a caller
wants to consume as it arrives) is the same shape again, just returning an `AsyncGenerator`:

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

Same guard, same metrics: a base iterative resolver calling another resolver still gets caught, and
a call still gets timed. `compositeIterativeResolver` is the composite half, same as everywhere
else.

One real difference from a regular resolver: the body doesn't run until the caller first pulls a
value from it, same as any JS async generator. Calling `getOrdersByUserIdPaged(...)` alone runs
nothing.

No streaming mutator: a write resolves once by nature.

## Metrics

Off by default:

```ts
const scope = createScope({ db, apiClient, session }, { metrics: true });
await getUserProfile({ id: 1 }, scope);

scope.$quoin.metrics;
// [
//   { path: ['getUserProfile', 'getUserById'],      name: 'getUserById',      kind: 'base',      durationMs: 0.41 },
//   { path: ['getUserProfile', 'getPostsByUserId'], name: 'getPostsByUserId', kind: 'base',      durationMs: 12.8 },
//   { path: ['getUserProfile'],                     name: 'getUserProfile',   kind: 'composite', durationMs: 13.1 },
// ]
```

`path` is what makes this more than a timer: the same resolver called from two composites shows up
as two entries you can tell apart. `durationMs` includes nested calls, so concurrent siblings
overlap and won't sum to their parent. Metrics record on every path (success, a returned failure,
or a throw) but don't duplicate the outcome itself: that's already known to the caller directly,
either from the return value or, in a composite, from each step it checks.

**TODO:** This has to be solved - currently the metrics pool will grow and grow and grow, and since we encourage one scope in the app, it will grow insanely large.
Options include:
- a metrics wrapper, that will track metrics onto the scope as they are passed and collect/present as part of the output alongside the result from the resolver itself, ie `runWithMetrics(getUserResolver(...)) => { metrics, result }`
  - This is probably cleanest, and leans toward a wrapper/transform concept I had in my first implementation but abandoned when it was unneeded later
  - basically allowing for different ways of entering the resolver execution, this time with metrics, but the metrics are recorded onto scope, but the scope is actually unique to the call and derived from the input scope at time of calling - this is actually a pretty cool positive addition
  - It also allows for standardizing a metrics response that still carries whatever the resolver response is as a nested value, so all the typing carries through and it makes metrics useful when wanted explicitly instead of just a config that then does nothing without _consuming_ the actual data
  - This also opens up the idea of a transformer pattern in general - where the resolver fetches data, and the transformer actually coerces that into a new shape - I have used that before when mapping a database row into a typed object with properties and methods
    - this is also prety powerful for composites since in general the transformers kind of stack as well, or at least the final shape once you have normalized the data output can
- metrics reset on call
  - allows fetching from scope but is still ugly and breaks our no magic rule
- metrics enabled as an option
  - I had rejected the idea of an options block as a standard param, this would lean back into adding it
  - the pro is that the first arg could go back to purely identity, and options are a combo of reserved quoin options + custom options
  - the con here is that it means the basic function shape changes, and options have to be supplied down the tree/respected in each resolver manually or magically

## Optimized composites

Occasionally a composed result isn't fast enough, and you write the same thing directly instead of
composing calls to other resolvers. Where that direct reach lands decides what it is:

- **Local.** One query joining what several resolver calls would otherwise touch separately — a SQL
  join standing in for a DB read plus another DB read, say. The resolver's own code is still the one
  doing the joining, so it's still a composite: an *optimized* one.
- **Remote.** One call to a purpose-built endpoint that already returns the shape you'd otherwise
  compose. The joining happened on the far side of a call this resolver doesn't control — from here
  it's one artifact from one source, so it's **base**, no matter how much composing produced that
  artifact upstream. `examples/client/resolvers/base/user.ts`'s `getUserProfile` is exactly this.

The rest of this section is the local case, the one that's still a composite and carries a
composite's obligations:

```ts
const getUserWithOrdersOptimized = compositeResolver(
  'getUserWithOrdersOptimized',
  async (params: { id: number }, scope: IAppScope) => {
    const rows = await oneLeftJoin(scope.db, params.id);
    return rows.length === 0
      ? fail({ code: 'USER_NOT_FOUND', message: `User ${params.id} not found` })
      : ok(shape(rows));
  }
);
```

Still a plain `compositeResolver`: "optimized" is a naming distinction, not a different factory.

**Reach for this rarely.** Across two systems with a decent data load this has been worth doing a
handful of times; a composed result is almost always fast enough, and it's clearer to write,
maintain, extend and reuse. Reaching past the base resolvers to the source is what buys the speed
and what costs the reuse. It also carries an obligation: match the composed version exactly,
including how it fails. Because both exist, that's directly testable:

```ts
it.each(SEEDED_USER_IDS)('return identical results for user %i', async (id) => {
  const [plain, optimized] = await Promise.all([
    getUserWithOrders({ id }, scope),
    getUserWithOrdersOptimized({ id }, scope),
  ]);
  expect(optimized).toEqual(plain);   // results compare whole: data, error and all
});
```

Metrics tell you whether the trade was worth making.

## API

| Export | |
|---|---|
| `resolver(name, fn)` | base read: `(params, scope)` |
| `compositeResolver(name, fn)` | read built from other resolvers |
| `mutator(name, fn)` | base write: `(params, value, scope)` |
| `compositeMutator(name, fn)` | write built from other resolvers/mutators |
| `iterativeResolver(name, fn)` | base read that streams: `(params, scope) => AsyncGenerator` |
| `compositeIterativeResolver(name, fn)` | streaming read built from other resolvers |
| `ok(data?)` / `fail(error?)` | results; both arguments optional |
| `createScope(app, options?)` | scope with the reserved block; `{ guard, metrics }` |

All six factories return a callable carrying `.info` (`{ name, kind }`) and never mutate the
function they were given. The four `resolver`/`mutator` factories always return a promise whether
the wrapped function is sync or async; the two `iterativeResolver` factories always return an
`AsyncGenerator`.

No error type: that's yours to define, and Quoin infers it from what your resolvers return.

## Examples

[`examples/`](./examples) is a runnable, tested app rather than snippets: in-memory sqlite and a
real local HTTP server, no mocks of the library itself.

```
examples/
  quoin.ts             the app's error shape, defined once
  db/, api/, cache/    sources — connection, query helper, HTTP client, in-memory cache store
  resolvers/
    base/user.ts       getUserById, setUserEmail
    base/order.ts      getOrdersByUserId, getOrdersByUserIdPaged (streaming)
    base/post.ts       getPostsByUserId  (HTTP-backed — still one data artifact, still base)
    base/cache.ts      getCachedValue, setCachedValue, markCacheStale,
                       removeCachedValue, removeAllCachedValues
    composite/user.ts  getCurrentUserOrders, updateUserEmail, getUserWithOrders(+Optimized),
                       getUserProfile (degrades to empty posts + postsError if the API is down)
    composite/cache.ts cachedApiFetch — cache read/write around a real fetch,
                       with force/cacheOnly controls
  scope.ts             the scope everything is threaded through
  server.ts            the app's own HTTP surface — what examples/client/ below talks to
  react/               components binding those same server-side resolvers via quoin/react
  client/              the browser side: same resolvers, same shape, fetch instead of db/apiClient
    api.ts             createAppApiClient — thin transport, no result-shape awareness
    scope.ts           IClientScope — an appApi client built once from the base URL
    resolvers/
      base/user.ts     getUserProfile  (fetch — one HTTP call where the server composed two)
      base/order.ts    getOrdersByUserId  (fetch)
      composite/user.ts getUserProfileWithOrders, composed client-side from those two
    react/             RemoteUserProfile, pulling that composite through quoin/react
```

This is the layout we settled on, not a prescription: nothing stops you doing one file per
resolver, or per data source, or some other scheme entirely. What we found useful: sources hold no
resolvers; `base/` and `composite/` are separate so a resolver's kind is visible from its path; and
there's one file per entity group rather than per resolver, so `user.ts` exists at both levels and
you can see an entity build up in one place. Composites import what they call directly — base
resolvers or other composites: what a composite composes is part of its implementation, not a
dependency handed in.

`examples/client/` is what "unified backend and frontend" cashes out to: the same resolver/composite
shape on both sides of a real network boundary, not a shared implementation. Its base resolvers are
named identically to their server-side counterparts and return the identical result type; only the
source changed, from `scope.db`/`scope.apiClient` to `fetch` against `examples/server.ts`. Where the
server needed a composite (`getUserProfile` spans DB and API), the client sees one HTTP endpoint and
so gets it as a base resolver. A client "optimized" composite is just a base resolver against a
use-case endpoint.

[`examples/README.md`](./examples/README.md) has how to actually run each piece, including the
no-build HTML page.

```
npm install
npm test
```

## Contributing

Conventions (including where AI-assisted implementation fits) are in
[CONTRIBUTING.md](./CONTRIBUTING.md). Licensed [MIT](./LICENSE).