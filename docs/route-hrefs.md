# Typed route references

NextJsHx generates a discoverable `href()` companion on each Haxe-owned route
declaration. Application code uses the route type it already knows instead of
repeating a filesystem pattern or calling a central string router:

```haxe
final href = TodoPage.href({id: todo.id});
Navigation.redirect(href);
```

The public result is `nextjs.route.RouteHref<Pattern>`. It behaves as a Haxe
`String`, while genes-ts projects it to the exact
`import("next").Route<Pattern>` boundary so Next's own generated route types
remain an independent oracle. Construction is intentionally one-way: a typed
href can flow to a `String`, but an arbitrary `String` cannot flow back into a
`RouteHref`. Only the internal, parser-validated companion expansion can create
one.

```haxe
final checked:RouteHref<TodoPattern> = TodoPage.href({id: todo.id}); // accepted
final forged:RouteHref<TodoPattern> = "/todos/unchecked";            // Haxe error
```

## Haxe-native call shape

The generated companion owns a named, non-generic `@:structInit` params class.
That uses Haxe's editor support and nominal field set while keeping object-style
calls concise:

```haxe
@:structInit
class TodoPageParams {
  public final id:TodoId;

  public inline function new(id:TodoId) {
    this.id = id;
  }
}
```

Missing fields, extra fields, wrong domain types, and the wrong argument count
fail in Haxe before TypeScript is emitted. A safely String-backed abstract is
accepted directly. A differently represented domain abstract must use the
validated `@:next.routeCodec(Type)` contract described in
[route-patterns.md](route-patterns.md); its `encode` method runs before URL
encoding.

The route declaration's build macro injects the actual companion. The low-level
`nextjshx.route.RouteHrefMacro` is an internal generation seam and is not an
application-facing API.

## Expansion and encoding

The companion is inline and macro-backed. Static calls expand to a literal at
the caller:

```ts
return "/about";
```

No `AboutRoute` helper module, path parser, encoder, template marker, or page
implementation appears in generated runtime output. Server and client Haxe
modules call the same companion and receive the same call-site expansion.

Every dynamic scalar is encoded with the platform `encodeURIComponent`
semantics. Required and optional catch-all arrays encode each element first and
then join the encoded segments with `/`; an authored slash inside a segment can
therefore never become a path separator. A codec-backed value is converted to
`String` by its validated codec and then encoded exactly once.

The internal macro uses `genes.TemplateLiteral.value` only after parsing the
closed route grammar and validating params. TypeScript therefore retains a
native template-literal expression and useful route shape:

```ts
return `/todos/${encodeURIComponent(id)}`;
```

Ordinary Haxe interpolation is the negative control: it becomes `+`
concatenation, widens to `string`, and fails Next's `Route<T>` check. Classic
Genes output receives equivalent parenthesized concatenation, preserving the
same value and evaluation order without exposing a helper call.

The only opaque-type construction is a private, erased representation coercion
inside `RouteHref`; application code cannot call it. It emits no cast or helper
in either target, and strict TypeScript checks the resulting literal or native
template against Next's independently generated `Route<T>` union.

## Topology-aware references

Generated references describe canonical request URLs, never adapter directory
syntax. These two declarations therefore produce the same URL shape for
different Next ownership roles:

```haxe
@:next.page("photo/[id]")
class PhotoPage { /* canonical hard-navigation owner */ }

@:next.page("@modal/(.)photo/[id]")
class InterceptedPhotoPage { /* soft-navigation modal view */ }

final destination = InterceptedPhotoPage.href({id: "42"});
```

`destination` is a typed `/photo/${string}` route. It contains neither
`@modal` nor `(.)`, so passing it to `NextLink` lets the Next runtime select the
intercepted view from the current route while a reload resolves the canonical
page. Route groups are erased in the same way. The parser retains all of that
filesystem topology in the adapter plan and CLI report; only URL construction
uses the resolved public segments.

## Same-zone and cross-zone intent

A generated `RouteHref` or `RouteHrefWithQuery` converts to `SameZoneHref` and
is accepted by semantic `NextLink`. For a deliberate literal that is not owned
by a Haxe route, make the transition intent explicit:

```haxe
<NextLink href={SameZone.href("/native-page")}>Native page</NextLink>
<a href={CrossZone.href("/documentation")}>Documentation zone</a>
```

Both constructors require one compile-time root-relative literal and reject a
protocol-relative path, traversal segment, whitespace, controls, backslashes,
or either quote. `CrossZoneHref` is deliberately rejected by semantic
`NextLink`; crossing a deployment zone needs a normal anchor and full-page
navigation. This prevents an innocuous-looking client transition from silently
depending on a router instance that does not own the destination.

## Optional catch-all compatibility

For `archive/[[...slug]]`, a present array produces `/archive/<segments>`. An
absent value produces `/archive/` on the pinned Next 16.2.12 lane. Next's
runtime owns the route with or without that trailing slash, but its generated
typed-route definition currently represents only the empty-final-segment form:

```ts
`/archive/${OptionalCatchAllSlug<T>}`
```

Emitting the accepted form keeps every generated href checked by Next rather
than adding a cast or editing `.next` output. Bead `nxhx-ax5` tracks a reduced
Next.js-only investigation and, if still applicable upstream, a generalized
fix that also admits the bare base URL.

## Native-route inventory and parity

`nextjshx routes` combines the fresh Haxe adapter plan with a read-only scan of
native `page.*` and `route.*` files. Every row states its `haxe` or `native`
origin and exact ownership status. For example, a native
`app/(shop)/catalog/[sku]/page.tsx` remains unowned and is reported as public
`/catalog/[sku]`; the route group is not copied into the URL or claimed by a
Haxe manifest.

`nextjshx routes --check` requires all Haxe-owned outputs to match the manifest,
then invokes pinned Next typegen and strict TypeScript. Next therefore verifies
the combined Haxe/native route graph. Each reported pattern receives a private,
temporary concrete `Route<literal>` assignment so an effective Next config
that omits the route fails instead of receiving a false `accepted` label. The
probe is deleted after the strict compiler run. The CLI does not edit generated
Next type files or parse them as a stable public format. It reports canonical,
parallel, and intercepted topology separately, rejects duplicate canonical
owners, rejects duplicate view identities, and requires every intercepted view
to have a canonical page. Malformed or ambiguous topology, custom route
extensions, and other unmodeled native syntax fail closed rather than receiving
a guessed Haxe ref. The complete inventory rules and diagnostic example are in
[cli.md](cli.md#routes).

The fixture's negative control assigns `/not-in-next-route-graph` to its exact
`Route<...>` type. Haxe and ordinary TypeScript both accept the literal as a
string, but strict TypeScript rejects it after Next typegen because no native or
Haxe-owned convention file supplies that route. This is the failure the
temporary CLI probe prevents from being mislabeled as parity.

## Typed query composition

Pathname-only `href()` remains the default. A page with
`@:next.query(QueryType)` also receives `hrefWithQuery(...)`, which applies a
closed named record only after pathname validation succeeds. It returns
`RouteHrefWithQuery<Pattern>` and uses native `URLSearchParams` semantics; no
arbitrary map or prebuilt search string is accepted. Scalar, optional,
repeated, renamed, and domain-codec fields, plus positive and negative examples,
are documented in [route-queries.md](route-queries.md).

Native TypeScript/JavaScript routes remain native and are not implicitly
claimed or regenerated by pathname generation, typed query composition, or
inventory.
