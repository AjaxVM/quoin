# Quoin

**A pattern for modelling and composing data access, exposed as a library.** Data access grows
messier as an application scales: every new source and integration adds to a maintenance burden
that compounds over time. Quoin is the pattern used to keep it uniform: every read and write
follows the same form, and complex results are built by composing simpler ones. The TypeScript
package is one implementation of that idea, meant to be easy to reimplement elsewhere. Weigh
changes against the pattern first and the package second.

## Shape of the thing

Resolvers read, mutators write, composites call other resolvers or composites instead of touching a
source directly: same shape either way, just a different label. See [README.md](./README.md) for
the concepts (`params`/`value`/`scope`, base vs composite) and
[CONTRIBUTING.md](./CONTRIBUTING.md) for naming and structure conventions.

Everything is functional and procedural: things are created and passed in, and operate on just
what they were passed. A call's behaviour is fully determined by what it's given: the scope's
call-chain tracking lives entirely in the derived scope each wrapper hands its inner function, so
a call behaves identically whether or not it ran inside a `Promise.all`, and concurrent siblings
are never attributed to each other.

## Conventions

See [CONTRIBUTING.md](./CONTRIBUTING.md): type naming (`T` simple / `I` interface+complex),
structure, and code style all live there. Don't restate them here.

## Working on this repo

- Examples are product, not scaffolding. The usage pattern is what this library actually sells, so
  hold `examples/` to the same standard as `src/`.
