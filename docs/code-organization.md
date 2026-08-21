# Code Organization

How you split resolvers and mutators across files is a separate question from the call shape, and a few general patterns stand out for their usefulness, each with a real tradeoff.
That said, Quoin is all about the pattern of resolvers, not enforcing a particular code organization.

## Base/composite split, one file per entity

```
resolvers/
  base/user.ts        resolvers and mutators over one source
  base/order.ts
  composite/user.ts   resolvers and mutators built out of other resolvers
  composite/order.ts
```

The default across implementations of this pattern so far (see `examples/` and
`CONTRIBUTING.md`'s own layout). `base/` and `composite/` as separate directories means a
resolver's kind is visible from its path, before you open the file. One file per entity rather than
per resolver means `user.ts` existing at both levels shows how that entity's resolvers build up in
one place, without scattering it across a dozen tiny files.

## Split by data source

```
resolvers/
  db/user.ts
  db/order.ts
  api/post.ts
```

Groups resolvers by what they touch, so which source a directory needs is legible from its name
alone. Useful if you want scope requirements obvious without opening any file.

Worth trying, but it tends not to hold up: composites cross sources often enough (a user row from
the DB plus posts from an API, say) that once composites make up a meaningful share of the
resolvers, this split stops telling you much. Base resolvers fit it fine. Composites just don't
always have a single source to file under.

## One file per resolver/mutator

Finest granularity. Easiest to find one specific resolver by filename, and diffs stay small and
scoped.

The tradeoff with this is that you will have the most files, and thus the most need for _another_ organization method to couple with this.
While you get that very focused view of a specific resolver, the context of what other related resolvers are doing, or for composites touching the same entity multiple times, is split across many files.

## Split by entity alone

The entity grouping without the base/composite axis: one `user.ts` holding everything about users,
base and composite together.

Reads fine for a small entity. Loses the at-a-glance "is this base or composite" signal the
default gets for free from directory structure, so that distinction has to come from reading each
resolver's own declaration (or its factory name) instead.

## What to reach for

Base/composite split, one file per entity, is the recommended default: it's held up across
multiple real implementations of this pattern, in a way the split by data source didn't. That's not
a hard rule. A small app with only a handful of resolvers, or one that genuinely never crosses
sources, might do fine with a split by source instead, and there's nothing about Quoin itself that
cares either way.
