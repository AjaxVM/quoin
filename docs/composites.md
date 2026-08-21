# Composites

A call's shape is identical whether it's base or composite: same signature either way. What
decides which factory to reach for is what the call touches. One data artifact reached directly
makes it base. More than one, whether reached by calling other resolvers or directly in one query,
makes it composite. The factories exist as separate names only so that distinction gets declared
up front instead of left for the reader to infer:

| | reads | writes |
|---|---|---|
| touches one data artifact | `resolver` | `mutator` |
| calls other resolvers/mutators | `compositeResolver` | `compositeMutator` |

`compositeIterativeResolver` is the streaming equivalent. See
[Resolvers § Streaming](./resolvers.md#streaming).

Every call carries its label: `getUserWithOrders.info` → `{ name, kind: 'composite' }`.

A composite's own calls don't have to be base themselves. A composite can call other composites
just as easily, layering a wide result out of narrower composed ones instead of reimplementing what
they already do. The guard doesn't care which. It only ever watches for a *base* resolver making
that jump.

```ts
const getUserWithOrders = compositeResolver(
  'getUserWithOrders',
  async (params: { id: number }, scope: IAppScope) => {
    const user = await getUser({ id: params.id }, scope);
    if (!user.success) return user;

    const orders = await getOrders({ userId: user.data.id }, scope);
    if (!orders.success) return orders;

    return ok({ ...user.data, orders: orders.data });
  }
);
```

## The cost of composing

Composing calls has a real cost: each one is a separate round trip to its source, so a composite
that fans out to several resolvers (or, worse, calls one inside a loop over a list) pays for
every one of them. It's the same N+1 problem that shows up around any ORM's active-record layer.
Quoin doesn't hide that cost or solve it automatically. [Metrics](./metrics.md) make it visible,
and [optimized composites](#optimized-composites) below are the answer once it actually matters.

## The guard

Mislabelling is the easy mistake: a base resolver quietly grows a call to another resolver. Quoin
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

The guard tracks calls between resolvers, to catch a base resolver crossing into composite
territory it hasn't declared. A base resolver can make as many raw calls as it needs, as long as
they're all in service of the one data artifact it's defined around: a transaction wrapper around a
single upsert, a retry, a config toggle, whatever the call requires. It stops being base the moment
those calls reach separate data artifacts (a user row and a permissions row from the same database,
say), even when that still happens through one raw call. The guard can't see that distinction
either way: it only tracks calls to other Quoin resolvers, so a body's internal calls are invisible
to it regardless of what they touch. Declaring correctly is on you: "one data artifact" is a
boundary you set for your domain. Quoin can't infer it for you.

## The composite scope rule

A resolver's scope must hold everything it *and everything it calls* will reach. A composite
spanning the DB and an API needs both present, or it breaks: `getUserProfile` calling
`getUserById` (needs `scope.db`) and `getPostsByUserId` (needs `scope.apiClient`) means
`getUserProfile`'s own scope has to carry both.

One app-wide [scope](./scope.md) is the cheapest way to never get that wrong.

## Composites are not atomic

A composite mutator that writes and then calls something that fails has **partially applied**: the
write stands. That follows from what a composite actually is. A resolver or mutator counts as
composite the moment its own implementation touches more than one data artifact: not only when it
calls other resolvers to do so, but also when it reaches multiple artifacts directly in a call of
its own, say a SQL join across tables it queries itself. Composing calls to separate resolvers is
simply the common way to build one. Each call is its own operation, succeeding or failing
independently, with nothing tying them together: a composite built this way only knows the
interface of what it calls, never the implementation.

A base resolver never runs into the atomicity question at all: touching exactly one artifact,
whatever shape it arrives in, leaves nothing to coordinate.

Whether to stop, roll forward, or compensate is that composite's business (Quoin doesn't decide
that for you). What's strongly recommended: track what already applied, and report it back whenever
a partial failure could matter to your application. A caller checking `applied` is trusting it's
complete:

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

For independent calls, fan out and check each. You decide what each failure means for the whole:

```ts
const [user, posts] = await Promise.all([
  getUser({ id }, scope),
  getPosts({ userId: id }, scope),
]);
if (!user.success) return user;                          // no profile without a user

if (!posts.success) {
  if (posts.error?.code === 'POSTS_NOT_FOUND') {
    return ok({ ...user.data, posts: [] });               // no posts is a legitimate empty state
  }
  return posts;                                            // an outage isn't, bubble it up
}

return ok({ ...user.data, posts: posts.data });
```

Degrading a failed secondary call to an empty result, versus bubbling it up as a failure of the
whole composite, is a judgment call for your domain (Quoin doesn't dictate it either way). What it
gives you is each result to decide with, checked at the one place that knows what's independent and
what isn't. A call site can do exactly the same fan-out when it wants several resolvers at once.

## Optimized composites

Occasionally a composed result isn't fast enough, and you write the same thing directly instead of
composing calls to other resolvers. This is a general-purpose escape hatch, not limited to one
scenario. Two problems show up often enough to be worth naming as examples:
[the N+1-style cost](#the-cost-of-composing) of fanning out to several resolvers when one direct
query would do, and [atomicity](#composites-are-not-atomic) when a mutating composite needs its
steps to succeed or fail together.

Optimizing the data access itself (an index, a DB view, a purpose-built API endpoint) is usually
the better fix, and reaching for it directly is exactly what an optimized composite is for, whether
the source you're optimizing is your own database or an API you call. The one case that *isn't* an
optimized composite: a purpose-built endpoint that already exists as its own resolver elsewhere,
which you just call normally. That's the Remote case below, and it's base, not composite.

Compose first, optimize second, and keep both. Writing the composed version first (even knowing it
won't be fast enough yet) gives you a working reference, and once the optimized version exists,
something to test it against: self-documenting and self-verifying, not just faster.

Where that direct reach lands decides what it is:

- **Local.** One query joining what several resolver calls would otherwise touch separately: a
  SQL join standing in for a DB read plus another DB read, say. The resolver's own code is still
  the one doing the joining, so it's still a composite: an *optimized* one. Because it's the one
  reaching the artifacts itself, it's also the one place atomicity becomes available: wrap that
  direct reach in a transaction (or use an endpoint that's already atomic) and the composite is
  atomic. A composite built by calling other resolvers can't do that. It never has direct access to
  wrap.
- **Remote.** One call to a purpose-built endpoint that already returns the shape you'd otherwise
  compose. The joining happened on the far side of a call this resolver doesn't control. From here
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
handful of times. A composed result is almost always fast enough, and it's clearer to write,
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

[Metrics](./metrics.md) tell you whether the trade was worth making.
