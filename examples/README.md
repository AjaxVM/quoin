# examples/

A runnable, tested app. Not snippets. Two sources (sqlite + a mock HTTP API), a small server of
its own, and a browser-side client talking to that server. See [Organization](../docs/organization.md)
for the general layout options and why base/composite-by-entity is the default used here. This
covers what's here at a level up and how to actually run each piece.

## Run everything

```
npm install
npm test
```

Runs every test in the repo, `examples/` included: the backend resolvers/composites against
in-memory sqlite and a mock Posts API, the app server, the client-side resolvers/composites against
a real running instance of that server, and the React bindings on both sides. No test here mocks
Quoin itself.

## The backend

`db/`, `api/`, `cache/` are the sources. `resolvers/base/` and `resolvers/composite/` are the
resolvers and mutators built over them: `scope.ts` assembles the one scope everything is threaded
through. `quoin.ts` defines this app's error shape once. `react/` has three components binding
server-side resolvers through `quoin/react` (`QuoinProvider`,
`useResolver`/`useMutator`/`useIterativeResolver`).

## The app server + client

`server.ts` is a small HTTP server exposing two of the backend's own resolvers as routes: `200` +
plain data on success, a non-2xx + the error body on failure. `client/` is the browser side of the
same story: `client/resolvers/base/` are fetch-backed resolvers with the same names and result
types as their server-side counterparts, `client/resolvers/composite/` composes them, and
`client/react/remote-user-profile.tsx` renders the result through the same `quoin/react` hooks the
backend's own React example uses, just pointed at a scope whose `appApi` talks over HTTP instead
of a DB connection. `client/scope.ts` builds that scope from a base URL.

Every test in `examples/server.test.ts` and `examples/client/**` starts a real instance of
`server.ts` (and the mock Posts API behind it) rather than mocking either: the same "no mocks of
the library itself" rule extends to not mocking the network boundary either.

## The no-build HTML page

`no-build.html` is one page, one `<script type="module">`, importing straight from `dist/`, no
bundler:

```
npm run build
npx serve .          # or: python -m http.server
```

then open `http://localhost:<port>/examples/no-build.html`. Module scripts don't load from a bare
`file://` URL (that's a browser rule, not anything Quoin imposes), so it needs serving over
http(s), not double-clicking.
