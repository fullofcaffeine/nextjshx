# Haxe Route Handler declarations

NextJsHx represents one App Router `route.ts` file as one annotated Haxe class.
The Haxe surface makes the route, params, supported HTTP methods, and response
shape discoverable before generation; the emitted adapter remains an ordinary
Next.js module with named uppercase exports.

## Authoring contract

Use `@:next.route` with an App-Router-root-relative literal and put exactly one
supported method annotation on each exported public static function:

```haxe
package app.api;

import js.lib.Promise;
import nextjs.raw.server.NextRequest;
import nextjs.raw.server.NextResponse;
import nextjs.raw.server.NextResponse.NextResponseBody;
import nextjs.raw.server.WebResponse;
import nextjs.route.RouteContext;

typedef EchoParams = {
  final id:String;
}

typedef EchoBody = {
  final method:String;
  final id:String;
}

@:next.route("api/echo/[id]")
class EchoRoute {
  @:next.GET
  public static function get(
    request:NextRequest,
    context:RouteContext<EchoParams>
  ):Promise<WebResponse> {
    return context.params.then(params -> new WebResponse('GET:${params.id}'));
  }

  @:next.POST
  public static function post(
    request:NextRequest,
    context:RouteContext<EchoParams>
  ):Promise<NextResponseBody<EchoBody>> {
    return context.params.then(params ->
      NextResponse.json({method: "POST", id: params.id})
    );
  }

  @:next.DELETE
  public static function remove(
    request:NextRequest,
    context:RouteContext<EchoParams>
  ):WebResponse {
    return new WebResponse("DELETE");
  }
}
```

The Haxe method can use an idiomatic lower-camel name such as `remove`; its
metadata supplies the exact Next export. Supported annotations are
`@:next.GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`. Private
helpers may remain unannotated. The declaration macro automatically retains
the annotated class through Haxe DCE because the eventual caller exists in a
separately generated TypeScript adapter.

Every exported method must be non-generic, public, and static, with exactly two
required arguments:

- `request` is `nextjs.raw.server.WebRequest` or `NextRequest`;
- `context` is `nextjs.route.RouteContext<Params>`;
- `context.params` is therefore always `Promise<Params>`;
- `Params` exactly matches the declared route's dynamic segments; and
- the explicit result is `WebResponse`, `NextResponse`, a typed
  `NextResponseBody<Body>`, or `Promise` of one of those response classes.

`RouteContext` is required by identity, not accepted merely because an object
has a similarly named `params` field. This prevents a structural alias from
silently changing Next's asynchronous params contract.

### Decoding request bodies

A typed route and request object do not make network bytes trustworthy. The
safe `WebRequest`/`NextRequest.json()` projection therefore returns
`genes.ts.Unknown`. Decode it once at the handler boundary:

```haxe
final result = await(RequestDecoder.json(request, CreateTodoCodec.decode));
return switch result {
  case Decoded(input): ResponseJson.withStatus({ok: true, title: input.title}, 201);
  case Rejected(issues): ResponseJson.invalid(issues, 422);
};
```

Returning `Decoded(value)` directly from an `Unknown` callback fails Haxe
typing, and `ResponseJson.ok` rejects functions or other non-JSON bodies at
compile time. Native JSON syntax/form parse failures become stable typed issues
instead of escaping as request-parser exceptions. The exact JSON/form/query
field APIs, positive and negative examples, and evidence are in the
[codec reference](codecs.md).

## Generated Next module

For the declaration above, the closed adapter plan requests
`app/api/echo/[id]/route.ts`. The renderer emits the equivalent shape:

```ts
import { EchoRoute } from "../../../../src-gen/app/api/EchoRoute";
import type { NextRequest as NextJsHxRouteRequest } from "next/server";

export const DELETE: (
  request: NextJsHxRouteRequest,
  context: RouteContext<"/api/echo/[id]">
) => globalThis.Response = EchoRoute.remove;

export const GET: (
  request: NextJsHxRouteRequest,
  context: RouteContext<"/api/echo/[id]">
) => Promise<globalThis.Response> = EchoRoute.get;
```

The adapter contains no body parsing, routing protocol, cast, or business
logic. Its Next-generated `RouteContext<"/api/echo/[id]">` signature is an
independent framework check over the already validated Haxe declaration.

Implementation imports are derived from the discovered App Router root, the
configured genes-ts output root, and the Haxe module. The CLI owns the internal
`nextjshx.app-root` and `nextjshx.generated-root` compiler defines; application
configuration cannot override them.

## Fail-closed examples

Two Haxe methods cannot claim the same Next export:

```haxe
@:next.GET public static function first(request, context):WebResponse;
@:next.GET public static function second(request, context):WebResponse;
```

That declaration fails with `NXHX-ROUTE-HANDLER-DUPLICATE-0008` at the second
annotation. `@:next.TRACE` fails with
`NXHX-ROUTE-HANDLER-METHOD-0002`, and a `String` return fails with
`NXHX-ROUTE-HANDLER-RESPONSE-0006`; no adapter plan is published for any of
those compilations.

The focused evidence command is:

```sh
npm run test:route-handlers
```

It locks the canonical GET/POST/DELETE plan snapshot plus exact source ranges
and messages for duplicate, unsupported-method, structural-context,
route-param, and incompatible-return failures. The stable fixture additionally
runs all three methods through a real Next 16.2.12 production server.
