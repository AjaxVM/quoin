# Why

Data access grows messier as an application scales: every new source and integration adds to a
maintenance burden that compounds over time. *Quoin* is the pattern I use to keep it uniform. Every
read and write follows the same form, and complex results are built by composing simpler ones.

A messy data access layer reveals the same handful of symptoms almost everywhere: each
function identifies and shapes its access differently (some take a connection, others close over one,
still others simply name the function differently: `findUser` vs. `getUserRow` or `loadUserWithOrders`), nothing is
instrumented so a slow endpoint can be difficult to trace because there are no parts to point at,
and failure handling is ad hoc, with some paths throwing, some returning `null`, and callers
learning the difference by trial and error.

Quoin makes the layer uniform enough to reason about:

- **One shape.** `(params, scope)` for reads, `(params, value, scope)` for writes.
- **Anticipated failure is data.** A 404, a permission denial, an API outage: those come back as
  values, not exceptions each caller must remember to catch.
- **Composition is declared.** A call either touches one data artifact directly or composes other
  calls. The library tells you when the two disagree.
- **The chain is observable.** Turn metrics on and every call is timed and attributed to its
  position, so "the profile endpoint is slow" becomes "`getPostsByUserId` is slow".

The pattern and implementation are functional, but execution is procedural and reproducible - it is
fully determined by the inputs. Every effect traces back to a specific call, not to a reaction or
implicit side effect somewhere else. Everything a call needs (connections, clients, session) is
created once and passed in explicitly, so a call operates on only what it was handed.

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
