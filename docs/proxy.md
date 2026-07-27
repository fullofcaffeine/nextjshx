# Haxe request proxy declarations

NextJsHx exposes Next 16.2.12's request interception boundary as one semantic
Haxe declaration. The generated file is still an ordinary Next `proxy.ts`;
there is no custom request runtime, routing loop, or matcher evaluator.

## Why this layer exists

While building the App Router fixture, the public `NextProxy`, `NextRequest`,
`NextFetchEvent`, `NextResponse`, and `ProxyConfig` bindings were already
available, but a Haxe application still had to hand-maintain a root TypeScript
file. That split ownership created three practical gaps:

- the implementation could be typed in Haxe while its exported function drifted
  from Next's `NextProxy` contract;
- matcher strings lived in unrelated TypeScript rather than beside the Haxe
  behavior they select; and
- a handwritten root file bypassed deterministic adapter planning and
  manifest-backed collision protection.

The semantic layer closes those gaps with compile-time literals and an exact
delegating adapter. It improves Haxe authoring ergonomics while leaving Next's
public types, matcher parser, placement rules, and runtime behavior authoritative.

## Positive example

```haxe
package app;

import nextjs.proxy.ProxyRequest;
import nextjs.proxy.ProxyResponse;

@:next.proxy
@:next.matcher("/products/:path*", "/account")
class RequestProxy {
	public static function proxy(request:ProxyRequest):ProxyResponse {
		final response = ProxyResponse.next();
		response.headers.set("x-request-path", request.nextUrl.pathname);
		return response;
	}
}
```

The Haxe macro sorts and deduplicates matcher literals, records one closed
adapter intent, and retains only the annotated entry for full DCE. The adapter
for an `app/` project is equivalent to:

```ts
import { RequestProxy } from "./src-gen/app/RequestProxy";
import type {
  NextProxy as NextJsHxProxy,
  ProxyConfig as NextJsHxProxyConfig,
} from "next/server";

export const proxy: NextJsHxProxy = RequestProxy.proxy;
export const config: NextJsHxProxyConfig = {
  matcher: ["/account", "/products/:path*"],
};
```

With `appRoot: "app"`, the target is package-root `proxy.ts`. With
`appRoot: "src/app"`, it is `src/proxy.ts`. Omitting `@:next.matcher` omits the
`config` export and its `ProxyConfig` import completely.

The Haxe function accepts one required semantic `ProxyRequest` (or raw
`NextRequest` escape hatch) and may accept a second required `NextFetchEvent`.
Its explicit result may be ergonomic `ProxyResponse`, raw `WebResponse`,
`NextResponse`, `NextMiddlewareResult`, or the supported Promise form. The
generated export is independently assigned to Next's public `NextProxy` type,
so the final TypeScript and `next build` gates remain authoritative.

`ProxyRequest` exposes the common URL, method, header, cookie, text, and safe
unknown-JSON reads without making the full inherited Web API graph part of each
Haxe implementation. `ProxyResponse.next()` covers the common continue-and-set-
headers flow. These are compile-time views of native Next objects, not wrappers;
raw request/response bindings remain the explicit advanced escape hatch.

## Negative controls

A stringly or structurally similar request is rejected in Haxe:

```haxe
@:next.proxy
class UnsafeProxy {
	public static function proxy(request:String):String {
		return request;
	}
}
```

This fails with `NXHX-PROXY-SIGNATURE-0004` before any plan or live adapter is
written. Without the semantic declaration, an application could instead write
an untyped delegating `proxy.ts`, allowing the Haxe and Next boundaries to drift
until a later build or request.

Matcher expressions are also rejected:

```haxe
class Matchers {
	public static inline final ACCOUNT:String = "/account";
}

@:next.proxy
@:next.matcher(Matchers.ACCOUNT) // rejected: not a metadata string literal
class ExpressionProxy { /* ... */ }
```

Each matcher must be a trimmed, slash-prefixed compile-time string of at most
512 characters. One annotation accepts 1–256 literals. Duplicate literals,
control characters, multiple matcher annotations, additional public fields,
generic declarations, optional/defaulted arguments, and competing App Router
boundary annotations fail at their Haxe source positions. Next's own build
still validates the complete matcher grammar; NextJsHx deliberately does not
reimplement it.

## Ownership and collision behavior

The root convention file is authorized as one exact output capability. The
publisher retains the normal broad allowlist only for the discovered `app/` or
`src/app/` tree and adds exactly `proxy.ts` or `src/proxy.ts`; it never grants
ownership over the package root or all of `src/`. The transaction journal
preserves the same exact-file authority for crash recovery.

If a native `proxy.ts` already exists without an exact manifest record,
generation fails with `NXHX-OWNERSHIP-UNOWNED-0008` and leaves its bytes
untouched. A previous manifest cannot claim a sibling such as `src/config.ts`.
Configured App Router roots other than the Next-recognized `app` and `src/app`
forms may still host ordinary adapters, but proxy rendering fails closed because
Next would not discover a safely derived convention root.

## Evidence

```sh
npm run test:proxy
npm run test:tooling
npm run test:fixture:next-stable
npm run test:fixture:next-stable:smoke
```

The focused fixture locks the canonical matcher plan, seven exact Haxe
diagnostics, and strict genes-ts output. CLI tests prove both supported roots,
the exact-file ownership boundary, journal authorization, and native collision.
The stable Next fixture type-checks and builds the generated adapter, then
executes a matched production request and verifies the Haxe-set response header.
