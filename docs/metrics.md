# Metrics

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

## Open problem: unbounded growth

**This isn't solved yet** (tracked as Issue#5). The metrics pool grows for the life of the scope it
was collected on, and since one app-wide scope is the encouraged pattern, that pool can grow very
large. Options under consideration:

- **A metrics wrapper**: `runWithMetrics(getUserResolver(...)) => { metrics, result }`. Metrics
  still record onto a scope, but that scope is unique to the call and derived from the input scope
  at call time, so the caller gets a standardized metrics response carrying the resolver's own
  result as a typed nested value. Metrics become something you opt into per call, not a config
  that silently accumulates until something reads it. This also opens the door to a general
  transformer pattern (a resolver fetches, a transformer reshapes) that composites could stack.
- **Metrics reset on call**: fetch-and-clear from scope. Works, but leans on scope mutation as a
  reset mechanism, which cuts against Quoin's no-magic rule.
- **Metrics as an options block**: would mean reopening the options-block design already rejected
  for the base call shape (params would go back to pure identity, with a separate options argument
  combining reserved Quoin options and custom ones). Changes the basic function shape, and every
  resolver in a chain would need to respect it.

> **Current thinking:** the metrics wrapper looks cleanest: it doesn't reopen the options-block
> design, and it doesn't lean on scope-mutation-as-reset. Still open: whether it wraps at
> definition time (`runWithMetrics(getUserResolver)`) or at call time
> (`runWithMetrics(getUserResolver(...))`), or needs to support both.

Until this lands, treat metrics as something to turn on for a bounded operation or a debugging
session, not something to leave on for a long-lived scope.
