# React

`quoin/react` is a separate subpath: importing from `quoin` alone never pulls React in.

```ts
import { QuoinProvider, useResolver, useMutator, useIterativeResolver } from 'quoin/react';
```

## Provider

Put one already-built scope (from `createScope`) on context, once, near the root:

```tsx
import { QuoinProvider } from 'quoin/react';

<QuoinProvider scope={scope}>
  <App />
</QuoinProvider>
```

`useQuoinScope()` reads it back. The three hooks below call it for you, or call it yourself. See
[useQuoinScope](#usequoinscope) below.

## useResolver

```ts
useResolver(resolver: IResolver): (params) => Promise<result>
```

Binds a resolver to the current scope: scope is already applied, so the returned function only
takes `params`. It does not manage loading/error/data state. That's on the component, same as any
other async call in React.

```tsx
import { useEffect, useState } from 'react';
import { useResolver } from 'quoin/react';
import { getUserById } from '../resolvers/base/user.js';

function UserProfile({ userId }: { userId: number }) {
  const getUser = useResolver(getUserById);
  const [result, setResult] = useState<TAppResult<IUser> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void getUser({ id: userId }).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => { cancelled = true; };
  }, [getUser, userId]);

  // render Loading… / the error / the data
}
```

## useMutator

```ts
useMutator(mutator: IMutator): (params, value) => Promise<result>
```

Same bind as `useResolver`, with the extra `value` argument.

```tsx
import { useMutator } from 'quoin/react';
import { updateUserEmail } from '../resolvers/composite/user.js';

function UpdateEmailForm({ userId }: { userId: number }) {
  const update = useMutator(updateUserEmail);

  // void update({ id: userId }, { email }).then((result) => { ... })
}
```

## useIterativeResolver

```ts
useIterativeResolver(resolver: IIterativeResolver): (params) => AsyncGenerator<result>
```

Binds the same way. Nothing runs until the component pulls from the generator, same as
[streaming resolvers](./resolvers.md#streaming) in general.

```tsx
import { useState } from 'react';
import { useIterativeResolver } from 'quoin/react';
import { getOrdersByUserIdPaged } from '../resolvers/base/order.js';

function OrderPages({ userId }: { userId: number }) {
  const getPages = useIterativeResolver(getOrdersByUserIdPaged);
  const [generator] = useState(() => getPages({ userId, pageSize: 2 }));

  // loadNextPage() calls generator.next(), appends page.data to state
}
```

## useQuoinScope

```ts
useQuoinScope<TAppScope extends TScope>(): TAppScope
```

The three hooks above are thin binds: this is what they call internally to read the scope off
context. Reach for it directly when you want to call a resolver or mutator yourself instead of
through a bound hook: inside an event handler, calling several resolvers conditionally, or
composing calls at the call site rather than in a resolver of their own.

```tsx
import { useQuoinScope } from 'quoin/react';
import { getUserById } from '../resolvers/base/user.js';
import { getOrdersByUserId } from '../resolvers/base/order.js';

function useUserSummary(userId: number) {
  const scope = useQuoinScope();

  return async () => {
    const [user, orders] = await Promise.all([
      getUserById({ id: userId }, scope),
      getOrdersByUserId({ userId }, scope),
    ]);
    // ...
  };
}
```

Throws if called outside a `QuoinProvider`.

See [`examples/react/`](../examples/react/) and [`examples/client/react/`](../examples/client/react/)
for full working components, including a client-side one pointed at an HTTP-backed scope instead of
a direct DB connection.
