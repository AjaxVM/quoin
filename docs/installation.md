# Installation

```
npm install quoin
```

React bindings live at a separate subpath, so React isn't pulled in unless you import it:

```ts
import { resolver, createScope } from 'quoin';
import { QuoinProvider, useResolver } from 'quoin/react';
```

`react` (`>=18`) is an optional peer dependency, only needed if you import `quoin/react`. Quoin
itself has no runtime dependencies.

Requires Node `>=14`. Ships as native ESM (`"type": "module"`). There's no CommonJS build.

> Quoin isn't published to npm yet. Until then, build it from source: clone the repo, `npm
> install`, `npm run build`. `dist/` is what the `quoin`/`quoin/react` imports above resolve to
> once it's linked or copied into your project.

## No bundler

`dist/` is plain ESM, so a browser can load it directly (no bundler, no build step of your own):

```html
<script type="module">
  import { resolver, ok, createScope } from './dist/index.js';
</script>
```

There is currently no public CDN. While this isn't the main use case, it is just fine for testing and prototyping.

See [`examples/no-build.html`](../examples/no-build.html) for a complete, working page.

Next: [Quickstart](./quickstart.md).
