# Typed route queries

NextJsHx can add a closed outbound query schema to a Haxe-owned page without
weakening its typed pathname. The result is still an ordinary URL consumed by
Next; the library adds no router, query runtime, or alternate matcher.

## Why this layer exists

The first typed route companions deliberately generated pathnames only. While
using them in the production fixture, query-bearing links still required one
of two unsafe fallbacks: concatenate a search string after a checked href, or
pass an arbitrary string/map to another helper. Either choice discarded the
named Haxe field contract at the point where URL encoding mattered.

`@:next.query(QueryType)` closes that gap. It keeps query names, cardinality,
and domain encoding beside the page declaration; preserves the original
pathname-only `href()`; and adds an explicit `hrefWithQuery()` companion.
Incoming page `SearchParams` remain untrusted raw URL input and still require a
decoder. Outbound construction does not pretend that decoding has happened.

## Positive example

Define one named, non-generic `@:structInit` class (or anonymous typedef) whose
fields are public and final:

```haxe
package app;

import genes.ts.Undefinable;

@:structInit
class ProductQuery {
  public final page:Int;
  public final preview:Undefinable<Bool>;

  @:next.queryName("tag")
  public final tags:Array<String>;

  public inline function new(
    page:Int,
    preview:Undefinable<Bool>,
    tags:Array<String>
  ) {
    this.page = page;
    this.preview = preview;
    this.tags = tags;
  }
}
```

Attach it to a page and call the generated companion:

```haxe
@:next.page("products/[slug]")
@:next.query(app.ProductQuery)
class ProductPage {
  // render remains typed with raw SearchParams input.
}

final preview:Undefinable<Bool> = Undefinable.absent();
final href = ProductPage.hrefWithQuery(
  {slug: "first"},
  {page: 2, preview: preview, tags: ["haxe next", "typed"]}
);
```

The value is:

```text
/products/first?page=2&tag=haxe+next&tag=typed
```

`ProductPage.href({slug: "first"})` remains available and still returns the
pathname without a query.

## Closed field contract

Each field selects one wire cardinality through its Haxe type:

| Haxe field | Wire behavior |
|---|---|
| `value:T` | Exactly one pair |
| `value:Undefinable<T>` | Zero pairs when absent, otherwise one |
| `value:Array<T>` | One pair per element, preserving array order |

Supported scalar `T` values are `String`, `Int`, `Bool`, transitively
String-backed abstracts, and a domain abstract with one validated
`@:next.queryCodec(CodecType)`. `Int` uses Haxe's signed 32-bit value and
`Bool` emits exactly `true` or `false`.

A non-String-backed domain value supplies the outbound conversion explicitly:

```haxe
@:next.queryCodec(app.PageNumberCodec)
abstract PageNumber(Int) from Int to Int {}

class PageNumberCodec {
  public static function encode(value:PageNumber):String {
    return Std.string(value);
  }
}
```

The codec must be a non-generic class with exactly one public static,
non-generic `encode(value:Domain):String` method. The generated call runs before
native query encoding. A malformed signature fails at the codec declaration.

By default the wire name is the Haxe field name. One
`@:next.queryName("wire-name")` literal may rename it. Names must begin with an
ASCII letter, contain only letters, digits, dots, underscores, or hyphens, and
be at most 128 characters. Duplicate wire names fail before output.

`Float`, `Null<T>`, nested arrays, optional repeated arrays, non-public or
mutable record fields, arbitrary maps, and prebuilt search strings are intentionally
unsupported. Add a precise domain codec or change the schema rather than
bypassing it.

## Determinism and URL semantics

The macro validates the pathname first, evaluates the pathname and query
objects once, and appends fields in canonical UTF-8 byte order by wire name.
Repeated values retain their authored array order. If every optional/repeated
field emits zero pairs, the bare pathname is returned without a trailing `?`.

Encoding uses the platform's native `URLSearchParams` implementation. This is
deliberately different from path-segment `encodeURIComponent` behavior:

- spaces become `+`;
- literal `+`, `&`, and `=` are percent-encoded;
- `~` becomes `%7E` under the URL-encoded form rules; and
- Unicode uses its UTF-8 percent encoding.

No value is encoded twice. Next remains the route oracle: emitted TypeScript
projects the result to a `Route` union containing the exact pathname and its
`` `${Path}?${string}` `` query form, and `next typegen`/strict TypeScript check
the discovered route graph.

## Negative controls

Missing, extra, and wrong fields fail at the call:

```haxe
ProductPage.hrefWithQuery(
  {slug: "first"},
  {page: "two", preview: preview, tags: [], forged: "admin"}
);
```

This cannot be replaced with a raw search string:

```haxe
// Rejected: String is not a closed query schema.
RouteQueryMacro.build("products/[slug]", {slug: "first"}, "page=2&forged=admin");
```

`RouteQueryMacro` is an internal code-generation seam, not an
application-facing escape hatch. Applications use the generated
`hrefWithQuery()` method. The seam owns pathname construction rather than
accepting a separately supplied href, and it rejects a dynamic pattern without
both exact params and a query using `NXHX-ROUTE-QUERY-HREF-0004`.

## Import and runtime behavior

The companion is inline and query metadata never enters the adapter plan.
Calling it from another Haxe module does not import the page implementation.
A domain codec is retained only when its runtime `encode` call is actually
needed. The only platform object added by the common path is native
`URLSearchParams`.

The generated `RouteHrefWithQuery<Pattern>` is one-way like `RouteHref`: it can
flow to `String`, but an arbitrary `String` cannot flow back into it. Its
private representation conversion erases in both genes-ts output modes and
emits no TypeScript assertion or helper call.

## Evidence

```sh
npm run test:route-hrefs
npm run test:page-layouts
npm run test:fixture:next-stable
npm run test:fixture:next-stable:smoke
```

The focused route fixture checks 13 runtime path/query results, 15 compile
failures (including mutable-field and dynamic-path-arity rejections),
strict emitted TypeScript, and Next `Route<T>` parity. The
page/layout fixture proves `@:next.query` injects the companion without adding
adapter metadata or a page import. The stable fixture builds under pinned Next
16.2.12 and renders the deterministic query link from production output.
