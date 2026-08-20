# Why

Data access grows messier as an application scales: every new source and integration adds to a
maintenance burden that compounds over time. *Quoin* is the pattern I use to keep it uniform. Every
read and write follows the same form, and complex results are built by composing simpler ones.

**TODO:** This doesn't quite flow as correct now, since it is interrupted by the quote/intro above.

> **Suggestion:** A messy data access layer has a shape. The same handful of symptoms show up
> everywhere:

That maintenance burden shows up as the same handful of symptoms.

**TODO:** THis text is not quite what I'd write, need's a human editor pass:

> **Suggestion:** Every function names and shapes its access differently: some take a connection,
> some close over one. Some are `findUser`, others `getUserRow` or `loadUserWithOrders`. Nothing is
> instrumented, so a slow endpoint can't be traced to a part: there are no parts to point at. And
> failure handling is ad hoc: some paths throw, some return `null`, and callers learn the difference
> by trial and error.

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

> **Suggestion:** This is deliberately functional and procedural: a call runs exactly as invoked,
> nothing more, nothing implied. That's the gain: execution stays traceable and consistent,
> because the same inputs always produce the same call graph, and every effect traces back to a
> specific call rather than to a reaction fired somewhere else that's hard to pin down. Everything
> a call needs (connections, clients, session) is created once and passed in explicitly, so a
> call operates on only what it was handed.

No registry, no DI container. Things are created and passed in, and operate on what they were
passed.

## Compared to other approaches

**TODO:** repository/DI-container language is less common verbiage amongst web developers, or even
data engineers, than "ORM" is — might not land as well, and there are others that could be
expressed here too — DAOs, manual calls through an API client, etc. Still need to settle this part.

A **repository pattern** or a hand-rolled service layer gets you partway there: one place per
entity, roughly. It doesn't get you the rest: nothing stops two repository methods from shaping
their access differently, nothing observes the chain, and composition is still whatever the author
happened to write. Quoin adds the parts a repository class doesn't: a declared, checked distinction
between touching one thing and composing several, and a uniform way to time and attribute the whole
call graph.

An **ORM's active-record layer** is exactly what Quoin means to supersede, not sit under
(deliberately, at the cost of a little more work up front, to sidestep a set of problems that shows
up in pretty much every ORM implementation eventually): a query only raw SQL can express, a DB view
added just to power one particular model shape, filtering that gets more contorted the more it's
asked to do. The wall that actually breaks things is a second data source (a read/filter-optimized
Elasticsearch index over the same data, for instance). It needs its own interface entirely, one
that was never going to fit cleanly into the ORM everything else was already built around. A
DB-backed resolver and that Elasticsearch-backed resolver compose through the exact same interface,
`(params, scope) => result`, because neither one was ever the foundation the other had to bend to
fit.

A **DI container or service locator** solves discoverability (find the right service) at some cost
to traceability: everything a call needs is passed in explicitly here, so nothing is resolved from
a container at call time. Quoin doesn't compete with DI for wiring an app together. It just doesn't
use one internally, and doesn't ask you to either.

**TODO:** the repository pattern and DI container aren't really superseded by Quoin the way an ORM
is — they're compositional/parallel: a DI-selected client can live in scope, a repository-style
layer could be built on resolvers. An ORM is a genuinely different way of thinking about data,
which is why it's the one actually being superseded above. The line below still treats all three
the same — needs to differentiate before this is done.

None of these are wrong tools. Quoin is narrower than any of them. It's specifically about the
read/write layer: one shape, declared composition, observable calls.
