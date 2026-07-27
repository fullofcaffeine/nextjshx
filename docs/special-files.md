# Loading, error, and not-found declarations

NextJsHx models four App Router special files as typed Haxe declarations while
leaving their runtime behavior entirely to Next.js. The declaration macro
validates the component contract and records a closed adapter intent; the CLI
later publishes a thin, manifest-owned convention file that delegates to the
genes-ts implementation.

This layer exists to improve the authoring experience at a framework seam that
is easy to get subtly wrong by hand. In particular, Next requires `error.tsx`
to be a Client Component and supplies it an exact `Error`/`reset` contract.
Haxe authors should not have to reproduce a module directive, an intersection
type, and a convention filename manually. NextJsHx derives all three without
changing Next's runtime behavior.

## Supported declarations

| Haxe annotation | Generated target | Haxe render contract | Next component mode |
| --- | --- | --- | --- |
| `@:next.loading("shop")` | `shop/loading.tsx` | `() -> Element` or `() -> Promise<Element>` | Server by default |
| `@:next.error("shop")` | `shop/error.tsx` | `ErrorProps -> Element` | Client; directive is automatic |
| `@:next.notFound("shop")` | `shop/not-found.tsx` | `() -> Element` or `() -> Promise<Element>` | Server by default |
| `@:next.default("shop/@modal")` | `shop/@modal/default.tsx` | `() -> Element`, `DefaultProps<Params> -> Element`, or either Promise result | Server by default |

Paths are App-Router-root-relative segment paths. They have no leading slash,
`app/` prefix, special filename, or extension. The empty string targets the
App Router root. The same fail-closed path grammar used by pages, layouts, and
Route Handlers rejects traversal, backslashes, malformed dynamic segments, and
malformed group, slot, or interception syntax.

Each declaration is a non-generic class with exactly one boundary annotation
and exactly one public static, non-generic `render` function. Additional public
fields are rejected because these special files currently have only a default
component export. Private implementation helpers remain ordinary Haxe.

## Loading and not-found

A loading fallback needs no props:

```haxe
package app.shop;

import genes.react.Element;

@:next.loading("shop")
class ShopLoading {
  public static function render():Element {
    return <main aria-busy>Loading shop…</main>;
  }
}
```

The generated adapter targets exactly `app/shop/loading.tsx`, stays a Server
Component, and default-exports a typed reference to `ShopLoading.render`.
Returning `Promise<Element>` is also supported for server-owned loading and
not-found components.

A segment-specific not-found view uses the Haxe-friendly camel-case annotation
while retaining Next's hyphenated filename:

```haxe
package app.shop;

import genes.react.Element;

@:next.notFound("shop")
class ShopNotFound {
  public static function render():Element {
    return <main>That product does not exist.</main>;
  }
}
```

Calling the supported `next/navigation` not-found API from a page still owns
the control flow and HTTP status. Next selects the generated
`shop/not-found.tsx`; NextJsHx does not emulate 404 routing.

## Parallel-slot defaults

Next 16 requires every named parallel slot to provide a `default` convention
for hard navigation or reload when Next cannot recover that slot's active
state. NextJsHx makes the fallback an explicit typed declaration:

```haxe
package app;

import genes.react.Element;

@:next.default("@modal")
class ModalDefault {
  public static function render():Element {
    return <span id="modal-default">No active modal</span>;
  }
}
```

For a slot below dynamic ancestors, use the exact Promise-shaped params rather
than reconstructing a pathname:

```haxe
import js.lib.Promise;
import nextjs.app.DefaultProps;

typedef WorkspaceParams = {
  final id:String;
}

@:next.default("workspace/[id]/@sidebar")
class SidebarDefault {
  public static function render(
    props:DefaultProps<WorkspaceParams>
  ):Promise<Element> {
    return props.params.then(params ->
      <aside>Fallback for workspace {params.id}</aside>
    );
  }
}
```

The annotation must end at one named `@slot`. Haxe validates inherited dynamic
params, and the CLI validates the future published tree as a whole: exactly one
Haxe-owned or native `default.js`, `.jsx`, `.ts`, or `.tsx` must exist per
slot. A missing fallback or competing Haxe/native owners fail before
publication. Generated output is the same short default-export adapter used by
other Server Components; there is no fallback router or runtime registry.

## Typed error boundary and reset

`nextjs.app.ErrorProps` is the semantic Haxe type for the values Next passes to
`error.tsx`:

```haxe
package app.shop;

import genes.react.Element;
import nextjs.app.ErrorProps;

@:next.error("shop")
class ShopError {
  public static function render(props:ErrorProps):Element {
    return <main>
      <p>{props.error.message}</p>
      <button onClick={props.reset}>Try again</button>
    </main>;
  }
}
```

The emitted TypeScript boundary remains exact:

```ts
{
  error: Error & { digest?: string };
  reset: () => void;
}
```

`error`, `message`, `name`, optional `stack`, optional `digest`, and the
zero-argument reset callback are discoverable in Haxe. There is no `Dynamic`,
unchecked cast, reflection lookup, or Next-specific runtime wrapper.

The adapter begins with the macro-owned directive before comments and imports:

```tsx
"use client";
// Generated by NextJsHx from app.shop.ShopError.render.
```

Without that derivation, an otherwise plausible hand-authored adapter can omit
`"use client"` and fail Next's own TypeScript/build validation. It can also
silently widen `reset` or treat the framework `Error` as an unrelated record.
The Haxe declaration removes those duplicate decisions while strict
TypeScript and `next build` remain independent final oracles.

## Fail-closed examples

A structural lookalike is deliberately insufficient, including one with a
wrong callback signature:

```haxe
typedef UnsafeErrorProps = {
  final error:String;
  final reset:String->Void;
}

@:next.error("shop")
class UnsafeError {
  public static function render(props:UnsafeErrorProps):Element {
    return <button onClick={() -> props.reset("retry")}>Retry</button>;
  }
}
```

This fails at the Haxe declaration with `NXHX-SPECIAL-ERROR-PROPS-0005`; no
adapter plan is written. Using the semantic `ErrorProps` also makes a
one-argument reset call fail through normal Haxe typing.

Other failures are source-positioned and stable:

- missing, instance, generic, or argument-bearing loading/not-found renders:
  `NXHX-SPECIAL-RENDER-0004`;
- asynchronous error renders, which cannot satisfy a Client Component:
  `NXHX-SPECIAL-ERROR-ASYNC-0007`;
- non-element results: `NXHX-SPECIAL-RETURN-0006`;
- a `default` outside a named slot or with the wrong inherited params:
  `NXHX-SPECIAL-DEFAULT-PATH-0009` / the exact route-parameter diagnostic;
- extra public fields: `NXHX-SPECIAL-FIELD-0003`; and
- multiple boundary annotations or unsafe paths:
  `NXHX-SPECIAL-BOUNDARY-0001` / `NXHX-SPECIAL-PATH-0002`.

The CLI renderer independently rejects a changed special-file target, missing
error directive, unexpected special-file directive, non-default export, or
noncanonical signature before publication.

## Evidence

Run the focused compile and plan evidence with:

```sh
npm run test:special-files
```

It checks exact plan bytes, schema validity, React's module-owned JSX import,
strict generated TypeScript, precise `Error`/`reset` output, nine isolated
macro diagnostics, and a direct Haxe reset-arity control. The stable Next
16.2.12 fixture then publishes all four special-file kinds among twelve owned
adapters, runs typegen and strict TypeScript, completes a Turbopack production
build, and proves actual runtime behavior:

- the Haxe loading fallback is present before the resolved page in streamed
  HTML;
- the Haxe not-found payload preserves HTTP 404 and hydrates visibly; and
- the root `@modal` slot renders its Haxe default on hard navigation while an
  intercepted Haxe page replaces it during a soft transition; and
- a real browser triggers an error, sees the Haxe boundary, invokes its typed
  reset callback, and observes the page recover.

Native TypeScript remains the ownership escape hatch for unsupported special
files such as `global-error`, `forbidden`, and `unauthorized` until each
receives its own typed contract and equivalent evidence.
