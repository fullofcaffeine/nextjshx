# Route-pattern contract

NextJsHx validates every Haxe-owned App Router declaration before it can enter
the adapter plan. The P0 model is deliberately closed: it accepts only syntax
whose filesystem target, public URL, and Haxe parameter shape are unambiguous.
Unsupported Next.js syntax fails at the owning declaration instead of being
normalized into a different route.

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

Dynamic names use the portable Haxe identifier grammar
`[A-Za-z_][A-Za-z0-9_]*`. Names must be unique within a route, and either form
of catch-all must be the final segment. Segment order and one-based segment
indexes are retained in the validated model. Because the supported grammar has
no URL-elided segment, a non-root public pattern is exactly `/` followed by the
validated declaration path.

The parser rejects these path shapes before rendering or writing anything:

- absolute and drive-prefixed paths, backslashes, empty segments, `.` and
  `..`;
- control characters, spaces, non-portable filename characters, trailing
  periods, and Windows device names;
- private or hidden segments beginning with `_` or `.`, and source-shaped
  `.js`, `.jsx`, `.ts`, or `.tsx` segments;
- unmatched, extra, or malformed dynamic brackets, duplicate parameter names,
  and non-terminal catch-alls;
- route groups, parallel-route slots, and intercepting-route markers.

Accepted ADR 0002 defers route groups, so `(marketing)/todos` is rejected in
P0 rather than silently becoming `/todos`. Parallel routes such as `@modal`
and interception markers such as `(..)photo` have their own diagnostics. Keep
routes needing these features, or static directory names outside the
conservative portable grammar, native TypeScript/JavaScript until their
semantics are implemented explicitly.

## Exact parameter shape

The params type must be an anonymous typedef containing exactly one required
field for every dynamic segment and no other fields. A static route therefore
uses an empty anonymous typedef. Missing, extra, optional, and wrongly typed
fields receive stable `NXHX-ROUTE-*` diagnostics at the declaration or field
source range.

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
`RouteParameterValidator` checks the exact anonymous params shape and any
codec. A successful result contains only the canonical filesystem path, public
pattern, ordered segments, ordered parameters, Haxe type identities, and
optional codec identities.

This phase does not render adapters, publish files, encode href values, detect
collisions between separate declarations, or execute application code. Those
remain downstream responsibilities and must consume this validated model.

## Evidence

Run the focused contract with:

```sh
npm run test:routes
```

The harness checks seven canonical positive routes in forward and reverse
registration order, a reviewed snapshot, 18 exact source-positioned failures,
absence of host paths, and absence of JavaScript output under Haxe
`--no-output`. It discovers the installed `genes-ts` source classpath through
`haxelib path genes-ts` and adds that classpath directly so the fixture checks
the real `genes.ts.Undefinable` type without activating the application code
generator. Invoke the npm command rather than the fixture HXML files directly.
