# Bindings, semantic APIs, and interop

NextJsHx has two deliberately different public layers:

- `nextjs.raw.*` is the precise compatibility layer for reviewed public
  Next.js and React APIs. Use it when you need the host API's exact concepts,
  return shape, or runtime value.
- `nextjs.*` is the application-authoring layer. It keeps Next.js as the
  runtime while using Haxe inference, closed types, macros, and source
  diagnostics to remove boilerplate and catch mistakes earlier.

Choose the semantic layer by default. Drop to `nextjs.raw.*` at a deliberate
interop seam or when no semantic façade exists. The raw layer is not
untyped—it is still Haxe-checked—but it intentionally preserves host concepts
that may be less convenient or less safe than the semantic API.

## A practical decision rule

| Need | Use | Example |
| --- | --- | --- |
| Author a route, page, layout, Hook, cache boundary, or Server Function | semantic `nextjs.*` plus framework-neutral `genes.react.*` | `@:next.page`, `RouteHref`, `genes.react.React.useState`, `ResponseJson` |
| Call a reviewed Next export directly | `nextjs.raw.*` | `Navigation.useRouter()`, `Headers.cookies()` |
| Render a Next component in HXX | semantic component identity with raw props | `<NextLink href={ProductsPage.href()}>` |
| Consume native TypeScript/JavaScript | a precise extern in the raw or integration namespace | native `useCounter` consumed by Haxe |
| Publish Haxe code to TypeScript/TSX | a generated typed adapter | a Haxe Hook imported by native TSX |
| Use an unsupported package or Next export | native source or a reviewed new binding | do not guess a declaration or import `next/dist/**` |

The semantic layer may improve authoring, but it may not change Next.js runtime
meaning. Generated adapters remain ordinary Next modules with canonical public
imports and no parallel router, component runtime, or RPC protocol.

## P0 raw bindings by example

Every currently supported P0 module is exercised by a checked Haxe consumer.
These examples are executable evidence, not documentation-only sketches.

### Core types: `next` and `next/types`

```haxe
import genes.ts.Unknown;
import nextjs.raw.NextConfig;
import nextjs.raw.Route;
import nextjs.raw.metadata.Metadata;
import nextjs.raw.metadata.Viewport;

final config:NextConfig = {
  typedRoutes: true,
  output: "standalone"
};
final metadata:Metadata = {
  title: {absolute: "Products"},
  description: "Typed catalogue"
};
final viewport:Viewport = {
  width: "device-width",
  initialScale: 1
};
final route:Route<Unknown> = "/products";
```

The full checked consumer also covers `ResolvingMetadata`,
`ResolvingViewport`, and `ServerRuntime`:
[CoreNavigationConsumer.hx](../tests/next-core-navigation/src/next_core_navigation/CoreNavigationConsumer.hx)
and [GeneratedConsumer.hx](../tests/next-binding-pipeline/src/next_binding_pipeline/GeneratedConsumer.hx).

### Components: `next/link`, `next/image`, and `next/form`

```haxe
import nextjs.components.NextForm;
import nextjs.components.NextImage;
import nextjs.components.NextLink;

return <main>
  <NextLink href="/products">Products</NextLink>
  <NextImage src="/hero.png" alt="Product hero" width={640} height={360} />
  <NextForm action="/search"><button type="submit">Search</button></NextForm>
</main>;
```

The `Next*` names prevent HXX from confusing components with intrinsic HTML
tags. They reuse the faithful `nextjs.raw.components.*` props and emit direct
imports from `next/link`, `next/image`, and `next/form`; they are not wrapper
components. See the positive and negative prop fixtures in
[tests/next-components](../tests/next-components/) and the HXX checks in
[tests/showcase-ui](../tests/showcase-ui/).

### Navigation: `next/navigation`

```haxe
import nextjs.raw.Navigation;

final pathname:String = Navigation.usePathname();
final params:{final id:String;} = Navigation.useParams();
final router = Navigation.useRouter();
router.push("/products", {scroll: false});

if (params.id == "missing") {
  Navigation.notFound();
}
```

`useParams` can infer a closed Haxe record from its destination. Read-only
search params omit mutators that Next rejects at runtime. Generated
`RouteHref` companions are the preferred semantic API for known application
routes. The complete direct-export fixture is
[CoreNavigationConsumer.hx](../tests/next-core-navigation/src/next_core_navigation/CoreNavigationConsumer.hx).

### Request context: `next/headers`

```haxe
import genes.js.Async.await;
import nextjs.raw.Headers;

final headers = await(Headers.headers());
final session = await(Headers.cookies());
final token = headers.get("authorization");
final cookie = session.get("session");
```

Cookie mutation is exposed separately through
`Headers.mutableCookies()` so read-only code does not accidentally acquire a
write capability. The async contracts and draft-mode behavior are exercised in
[ServerConsumer.hx](../tests/next-server/src/next_server/ServerConsumer.hx).

### Cache operations: `next/cache`

```haxe
import nextjs.raw.Cache;
import nextjs.raw.cache.CacheTypes.CacheLifeProfile;

Cache.cacheLife(CacheLifeProfile.Minutes);
Cache.cacheTag("products", "tenant:42");
Cache.revalidateTag("products", CacheLifeProfile.Max);
```

The raw calls preserve Next's functions while closed Haxe values replace
misspelled profile and scope strings. For directive placement and generated
cache references, use the semantic API described in
[Cache Components](cache-components.md).

### Server and Web boundaries: `next/server`, `Request`, and `Response`

```haxe
import nextjs.raw.server.NextRequest;
import nextjs.raw.server.NextResponse;
import nextjs.raw.server.WebResponse;

public static function get(request:NextRequest):WebResponse {
  return NextResponse.json({
    ok: true,
    path: request.nextUrl.pathname
  });
}
```

External `request.json()` and `response.json()` values remain unknown until a
codec validates them. A response created locally with `NextResponse.json`
retains its body type. The complete raw fixture is
[ServerConsumer.hx](../tests/next-server/src/next_server/ServerConsumer.hx);
the semantic production Route Handler is
[EchoRoute.hx](../tests/fixtures/next-stable/haxe/route_handler_fixture/EchoRoute.hx).

## Bidirectional Haxe and TypeScript interop

Native TypeScript and JavaScript remain first-class source owners. A Haxe
extern describes only the supported closed contract:

```haxe
typedef CounterState = {
  final count:Int;
  final increment:Void->Void;
}

extern class CounterHook {
  @:next.hook
  @:jsRequire("./native-counter", "useCounter")
  static function useCounter(initial:Int):CounterState;
}
```

The reverse direction uses a generated, directive-first typed adapter. A
Haxe-authored Hook can be consumed from ordinary TSX without a wrapper call:

```ts
"use client";

import { useCounter } from "./generated/counter-hooks";

export function Counter() {
  const counter = useCounter(0);
  return <button onClick={counter.increment}>{counter.count}</button>;
}
```

Executable examples for both directions live in
[tests/client-components](../tests/client-components/) and are explained in
[React Hooks and bidirectional interop](react-hooks.md). Mixed native and
generated route ownership is exercised by
[tests/fixtures/next-stable](../tests/fixtures/next-stable/). Third-party
package patterns and declaration-review requirements are documented in
[Package integrations](package-integrations.md).

For one complete existing-application workflow—native component, Hook, module,
route, and the reverse Haxe exports together—see
[Gradual adoption in an existing Next.js application](mixed-language-adoption.md)
and the executable [Patchbay 06 example](../examples/mixed-adoption/).

## Escape-hatch policy

An escape hatch is explicit and narrow:

1. Prefer a reviewed public `nextjs.raw.*` binding.
2. If the API is unsupported, keep the module native or add a precise reviewed
   binding with positive and negative fixtures.
3. If external data is open, decode it immediately into a closed model.
4. Keep native source and generated source under separate manifest ownership.

Do not:

- runtime-import `next/dist/**`;
- introduce `Dynamic`, `Any`, `untyped`, broad `unknown`, reflection, or an
  unchecked assertion to make a call compile;
- edit generated `.next` files;
- claim support merely because a declaration exists in `node_modules`;
- move ordinary application logic to TypeScript solely to bypass Haxe
  checking.

If a public upstream declaration genuinely cannot be represented, document
the smallest boundary and add executable malformed-input or misuse evidence.
Unsupported behavior must fail with an actionable diagnostic.

## Stability

Support is exact and reviewed, not wildcard compatibility:

- stable Next.js support is the version recorded in
  [support_matrix.json](../support_matrix.json);
- reviewed exports and signatures are locked in
  [the public binding inventory](binding-policy.md);
- declaration drift fails closed and names the owning binding group;
- P2, experimental, legacy, and private exports remain unsupported until their
  own review and fixtures land.

Strict TypeScript and production Next builds remain independent parity checks.
They do not replace Haxe/HXX checking: application mistakes should fail at the
Haxe source span before generated output exists whenever the contract is
expressible in Haxe.
