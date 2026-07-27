# Cache Components and cached functions

NextJsHx exposes Next.js Cache Components as semantic Haxe boundaries. The
Haxe layer owns early declaration checks, precise generated references, and
directive placement; Next.js still owns cache keys, storage, invalidation,
deployment integration, and the final production-build semantics.
There is no NextJsHx cache runtime.

This layer was needed while implementing the first stateful App Router
fixture. Direct `next/cache` bindings made `cacheLife`, `cacheTag`, and
revalidation callable from Haxe, but they could not express whether `"use
cache"` belonged at module scope or inside one async function. They also could
not prevent a consumer from importing the uncached implementation directly.
The strict Next 16.2.12 build exposed an additional transform constraint: a
cached page must be emitted as a direct async default function export, not an
async declaration followed by a separate default-export statement. The
adapter renderer now owns that exact native shape.

## Enable the capability deliberately

Shared caching is disabled by default. Enable it in both the NextJsHx project
contract and the native Next configuration:

```json
{
  "next": {
    "package": "next",
    "typedRoutes": true,
    "cacheComponents": true,
    "experimentalCacheDirectives": []
  }
}
```

```js
/** @type {import("next").NextConfig} */
const nextConfig = {
  cacheComponents: true,
  typedRoutes: true,
};

export default nextConfig;
```

`next.cacheComponents` authorizes the compiler capability and lets the CLI
supply its private `nextjshx.cache-components` define. `cacheComponents` in
`next.config.mjs` activates the actual Next feature. NextJsHx intentionally
does not edit or infer the native configuration.

Next 16.2.12 rejects the legacy route-segment exports `dynamicParams` and
`revalidate` whenever Cache Components are active, even when `dynamicParams`
is explicitly set to its normal `true` behavior. Omit both and express cache
lifetime where the cached work is declared:

```haxe
@:next.cache("catalog/list")
class CachedCatalog {
  @:async
  public static function list():Promise<Array<Product>> {
    Cache.cacheLife(CacheLifeProfile.Hours);
    return Catalog.read();
  }
}
```

This legacy segment shape fails in Haxe with
`NXHX-SEGMENT-CACHE-COMPONENTS-0002`, before Next's later build error:

```haxe
public static final segment = SegmentConfig.create({
  dynamicParams: true,
  revalidate: 60
});
```

This early diagnostic was added after the maintained todo app enabled the
native feature and reproduced both incompatible exports. `maxDuration`,
`runtime`, and `preferredRegion` retain their separately validated contracts;
the Haxe layer does not infer broader incompatibility than the pinned Next
evidence demonstrates.

Private and remote cache directives are separate experimental capabilities:

```json
{
  "next": {
    "package": "next",
    "typedRoutes": true,
    "cacheComponents": true,
    "experimentalCacheDirectives": ["private", "remote"]
  }
}
```

An application cannot spoof the corresponding `nextjshx.*` Haxe defines. The
CLI derives them only from the validated configuration. Remote caching may
also require deployment-specific native cache-handler configuration; an
annotation never invents a remote store.

## Choose the smallest cache boundary

| Haxe declaration | Native directive placement | Use it for |
| --- | --- | --- |
| `@:next.cache("path")` | Inside every generated async function wrapper | Reusable shared cached functions |
| `@:next.cachePrivate("path")` | Inside every generated async function wrapper | Explicit request-aware private caching |
| `@:next.cacheRemote("path")` | Inside every generated async function wrapper | Explicit host-backed remote caching |
| `@:next.page(...)` or `@:next.layout(...)` plus a zero-argument cache annotation | Byte zero of the generated convention module | A whole async page or layout module |

Prefer a standalone cached function when only a data operation needs caching.
It produces a narrow key surface and leaves request handling outside the cache
scope.

When a page calls `Server.connection()` or another request-time API outside a
cached scope, Next requires that dynamic subtree beneath React Suspense. Use
the direct typed `nextjs.raw.react.Suspense` component and put the request-time
work in its child component; do not suppress Next's blocking-route diagnostic
or move request data into a shared cache merely to make prerendering pass.

## Reusable cached function

Declare one concrete class with a portable, extensionless logical path. Every
public member is part of that cache boundary and must be a public static,
non-generic, `@:async` function with required arguments and an explicit
`Promise<Result>`:

```haxe
package catalog.cache;

import js.lib.Promise;
import nextjs.raw.Cache;
import nextjs.raw.cache.CacheTypes.CacheLifeProfile;

typedef ProductSummary = {
	final sku:String;
	final label:String;
}

@:next.cache("catalog/product")
class CachedProducts {
	@:async
	public static function find(sku:String):Promise<ProductSummary> {
		Cache.cacheLife(CacheLifeProfile.Hours);
		Cache.cacheTag('product:$sku');
		return loadProduct(sku);
	}

	static function loadProduct(sku:String):Promise<ProductSummary> {
		// Private helpers remain implementation details.
		return Promise.resolve({sku: sku, label: 'Product $sku'});
	}
}
```

Consumers cross the boundary through `CacheFunction.ref`, which preserves the
selected Haxe function type while importing only the generated native wrapper:

```haxe
import catalog.cache.CachedProducts;
import nextjs.cache.CacheFunction;

final findProduct = CacheFunction.ref(CachedProducts.find);
final product = await(findProduct(sku));
```

Calling `CachedProducts.find(sku)` directly is not equivalent: it bypasses the
generated function containing the directive. Known direct implementation
edges are rejected; use the generated ref so the native cache boundary cannot
be removed accidentally during a refactor.

The generated adapter remains ordinary Next.js code:

```ts
// Generated by NextJsHx from catalog.cache.CachedProducts.find.

import { CachedProducts } from "../../../../src-gen/catalog/cache/CachedProducts";

export async function find(
  ...args: Parameters<typeof CachedProducts.find>
): Promise<Awaited<ReturnType<typeof CachedProducts.find>>> {
  "use cache";
  return CachedProducts.find(...args);
}
```

The directive is deliberately inside the function body. Putting it at module
scope would cache unrelated exports and change the boundary the Haxe author
declared.

## Cache a page or layout module

Use the zero-argument form only as a modifier on `@:next.page` or
`@:next.layout`. Every generated function export used under the file directive
must be async; static metadata remains a value:

```haxe
package catalog.app;

@:next.page("catalog")
@:next.cache
class CatalogPage {
	@:async
	public static function render(
		_props:PageProps<NoParams, SearchParams>
	):Promise<Element> {
		Cache.cacheLife(CacheLifeProfile.Hours);
		Cache.cacheTag("catalog");
		return <main><h1>Catalog</h1></main>;
	}
}
```

The renderer places `"use cache"` before imports and emits the direct default
declaration required by the pinned Next transform:

```ts
"use cache";

import { CatalogPage } from "../../src-gen/catalog/app/CatalogPage";
import type { JSX } from "react";

export default async function NextJsHxDefault(
  ...args: Parameters<typeof CatalogPage.render>
): Promise<Awaited<ReturnType<typeof CatalogPage.render>>> {
  return CatalogPage.render(...args);
}
```

A path argument on a page/layout cache modifier is rejected because the route
already owns the generated convention path. Conversely, a standalone cached
class requires exactly one path argument and is always colocated under the
private `_nextjshx/cache/` App Router directory.

## Keep request data outside shared and remote scopes

Ordinary shared and remote cache functions must not read request-time cookies,
headers, or `connection()` directly. Decode the request input at the route or
page boundary, then pass the closed value as a cache argument:

```haxe
@:next.GET
public static function get(
	request:NextRequest,
	_context:RouteContext<NoParams>
):Promise<NextResponseBody<ProductSummary>> {
	final rawSku = request.nextUrl.searchParams.get("sku");
	final sku = rawSku == null ? "featured" : StringTools.trim(rawSku);
	final findProduct = CacheFunction.ref(CachedProducts.find);
	return findProduct(sku).then(product -> ResponseJson.ok(product));
}
```

The tempting negative shape fails before a plan is published:

```haxe
@:next.cache("catalog/request-coupled")
class RequestCoupledCatalog {
	@:async
	public static function find():Promise<String> {
		final tenant = (await(Headers.headers())).get("x-tenant");
		return tenant == null ? "public" : tenant;
	}
}
```

NextJsHx reports `NXHX-CACHE-REQUEST-0006` for known direct request-API edges.
This early check is intentionally not a complete transitive graph proof; the
strict Next production build remains blocking for native TypeScript and
third-party dependencies.

`@:next.cachePrivate("path")` is the explicit exception for request-aware
private caching. It must be named in `experimentalCacheDirectives`, and its
different semantics must be visible in source review. Do not switch a shared
cache to private merely to silence a diagnostic: first decide whether the
result really is safe and useful as request-local cached data.

## Closed arguments and results

Cached-function arguments participate in native cache-key construction, and
results cross the cache serialization boundary. NextJsHx therefore accepts a
conservative closed subset:

- strings, booleans, integers, and floats;
- arrays of accepted values;
- closed plain records composed from accepted values;
- `Null<T>` and `Undefinable<T>` around accepted values; and
- string-, number-, or Boolean-backed abstracts.

`Void` is also accepted as a result. Functions, class instances, runtime Haxe
enums, recursive graphs, `Dynamic`, `Any`, and `genes.ts.Unknown` fail with
`NXHX-CACHE-SERIALIZABLE-0005`. Decode broad external values before they enter
a cache key. The validator does not prove captured JavaScript state or every
transitive dependency; keep implementations server-side and rely on the final
Next build as well.

## Lifetime, tags, and invalidation

The semantic boundary composes with the direct, typed `next/cache` bindings:

- call `Cache.cacheLife(CacheLifeProfile.Hours)` or a typed
  `CacheLifeConfig` inside a cached scope;
- call `Cache.cacheTag(...)` inside that scope to associate invalidation tags;
- use `Cache.revalidateTag(tag, profile)` where Next permits revalidation;
- use `Cache.updateTag(tag)` for the native immediate read-your-own-writes
  Server Function behavior;
- use `Cache.revalidatePath(path, RevalidatePathType.Page)` for a closed path
  scope; and
- use `Cache.refresh()` only in the native context supported by Next.

Next 16 requires the second `revalidateTag` argument, so NextJsHx omits the
deprecated one-argument spelling. Built-in profiles are closed and
discoverable; a profile declared by the application is an explicit
`CacheLifeProfile.custom("inventory")` value. These are direct public
`next/cache` imports, not wrapper-runtime calls.

## Security and deployment limits

A cache annotation is not authentication, authorization, tenant isolation, or
input validation. Never place per-user secrets in a shared or remote cached
result. Tags are invalidation labels, not access-control boundaries, and a
predictable tag does not grant permission to mutate data. Route Handlers and
Server Functions must perform their ordinary authorization checks before
revalidation or mutation.

Private and remote directives remain explicit because their availability and
storage behavior can depend on the Next release and deployment host. This
release proves their exact directive shapes and a pinned production build; the
runtime reuse/invalidation proof intentionally exercises stable shared
`"use cache"` behavior.

## Executable evidence

Run:

```sh
npm run test:cache-boundaries
```

The fixture compiles every cache variant twice, validates the adapter plan,
checks exact module/function directive placement, and requires nine focused
Haxe failures for missing capabilities, request access, a raw implementation
edge, sync boundaries, unsupported values, and incompatible segment exports.
It then publishes with the real
CLI, runs strict TypeScript and a Next 16.2.12 Turbopack production build,
starts the production
server, and proves that equal arguments reuse one result, different arguments
produce a different key, and tag invalidation recomputes the original key.
Generated and build-owned output is removed afterward.
