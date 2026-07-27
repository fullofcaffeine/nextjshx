# Route-pattern contract

NextJsHx validates every Haxe-owned App Router declaration before it can enter
the adapter plan. The model is deliberately closed: it accepts only syntax
whose filesystem target, canonical public URL, topology role, and Haxe
parameter shape are unambiguous. Unsupported or malformed Next.js syntax fails
at the owning declaration instead of being normalized into a different route.

## Accepted grammar

Declaration paths are relative to the discovered `app/` or `src/app/` root,
use `/` separators, and omit the special filename and extension.

| Declaration segment | Meaning | Required Haxe field |
| --- | --- | --- |
| `""` as the whole path | Root route, public pattern `/` | None |
| `about` | Static segment | None |
| `[id]` | One dynamic segment | `id:String` or an accepted abstract |
| `[...slug]` | Required catch-all | `slug:Array<String>` |
| `[[...slug]]` | Optional catch-all | `slug:genes.ts.Undefinable<Array<String>>` |
| `(marketing)` | Filesystem route group, omitted from the URL | None |
| `@modal` | Named parallel-route slot, omitted from the URL | None |
| `(.)photo` | Intercept at the same URL-segment level | Fields from the resolved target |
| `(..)photo` | Intercept one URL-segment level above | Fields from the resolved target |
| `(..)(..)photo` | Intercept two URL-segment levels above | Fields from the resolved target |
| `(...)photo` | Intercept from the App Router root | Fields from the resolved target |

Dynamic and slot names use the portable Haxe identifier grammar
`[A-Za-z_][A-Za-z0-9_]*`; `@children` is reserved by Next. Dynamic names must
be unique within a route, slot ancestry must not repeat a name, and either form
of catch-all must be the final public URL segment. Segment order and one-based
filesystem indexes are retained in the validated model.

Filesystem topology and public URLs are separate outputs. Groups and slots
remain in `segments` so the adapter owns the exact Next directory, but they are
absent from `publicSegments`. An interception marker is attached directly to
its target segment and resolves by URL-segment depth, so groups and slots do
not count as `(..)` levels:

| Declaration path | Topology | Canonical public path |
| --- | --- | --- |
| `(marketing)/about` | canonical | `/about` |
| `@analytics` | parallel view | `/` |
| `@modal/(.)photo/[id]` | intercepted view | `/photo/[id]` |
| `feed/@modal/(..)photo/[id]` | intercepted view | `/photo/[id]` |
| `workspace/@modal/(...)account/[id]` | intercepted view | `/account/[id]` |

An intercepted page is not a second canonical owner. It augments soft
navigation and requires an ordinary canonical page for the same public path so
hard navigation and reload have a complete route. Its generated `href()` also
targets that canonical path; `@modal` and `(.)` never leak into application
URLs.

The parser rejects these path shapes before rendering or writing anything:

- absolute and drive-prefixed paths, backslashes, empty segments, `.` and
  `..`;
- control characters, spaces, non-portable filename characters, trailing
  periods, and Windows device names;
- private or hidden segments beginning with `_` or `.`, and source-shaped
  `.js`, `.jsx`, `.ts`, or `.tsx` segments;
- unmatched, extra, or malformed dynamic brackets, duplicate parameter names,
  and non-terminal catch-alls;
- empty, nested, private, reserved, or non-portable group and slot names; and
- detached or repeated interception markers and relative markers that exceed
  the available URL-segment depth.

Each topology failure has a specific `NXHX-ROUTE-GROUP-0001`,
`NXHX-ROUTE-SLOT-0001`, or `NXHX-ROUTE-INTERCEPTION-0001` diagnostic. Static
directory names outside the conservative portable grammar remain native until
their semantics can be modeled without guessing.

## Exact parameter shape

The params type must be an anonymous typedef or a non-generic `@:structInit`
class containing exactly one required field for every dynamic segment and no
other fields. Generated route companions use the class form so editors expose
a named Haxe call shape while callers retain concise object syntax and receive
missing, extra, and wrong-type errors before output. Static declarations may
use an empty anonymous typedef. Validation failures receive stable
`NXHX-ROUTE-*` diagnostics at the declaration or field source range.

A single dynamic field accepts `String` or a transitively String-backed Haxe
abstract without runtime conversion:

```haxe
abstract TodoId(String) from String to String {}

typedef TodoParams = {
  final id:TodoId;
}
```

A domain abstract with another representation must opt into a reviewed codec.
The metadata takes a class type path; using a fully qualified path avoids
package-dependent resolution:

```haxe
@:next.routeCodec(app.routing.OrderIdCodec)
abstract OrderId(Int) {
  public inline function new(value:Int) {
    this = value;
  }
}

class OrderIdCodec {
  public static function decode(value:String):OrderId {
    final parsed = Std.parseInt(value);
    return new OrderId(parsed == null ? 0 : parsed);
  }

  public static function encode(value:OrderId):String {
    return Std.string(value);
  }
}
```

The codec must be a non-generic class with public, static, non-generic methods
whose exact signatures are `decode(value:String):T` and
`encode(value:T):String`. Haxe resolves the codec type path, and NextJsHx
validates both methods without `Dynamic`, `Any`, `untyped`, or a broad cast.
Validated bindings retain the codec identity for downstream adapter and href
generation.

Optional catch-all absence is represented by the value type
`genes.ts.Undefinable<Array<String>>`; the anonymous field itself remains
required. `Null<Array<String>>` and `final ?slug:...` are intentionally
rejected because they do not express the same generated TypeScript contract.

## Validation boundary

`RoutePatternParser` is a total, side-effect-free parser. The macro wrapper
attaches a parser failure to the owning Haxe position, then
`RouteParameterValidator` checks the exact anonymous or `@:structInit` params
shape and any codec. A successful result contains only the canonical filesystem
path, public pattern, topology role, ordered filesystem and public segments,
slot ancestry, optional interception record, ordered parameters, Haxe type
identities, and optional codec identities.

This phase does not render adapters, publish files, encode href values, detect
collisions between separate declarations, or execute application code. Those
remain downstream responsibilities and must consume this validated model.

## Evidence

Run the focused contract with:

```sh
npm run test:routes
```

The harness checks fifteen canonical, grouped, parallel, and intercepted routes
in forward and reverse registration order, a reviewed snapshot, 21 exact
source-positioned failures,
absence of host paths, and absence of JavaScript output under Haxe
`--no-output`. It discovers the installed `genes-ts` source classpath through
`haxelib path genes-ts` and adds that classpath directly so the fixture checks
the real `genes.ts.Undefinable` type without activating the application code
generator. Invoke the npm command rather than the fixture HXML files directly.
