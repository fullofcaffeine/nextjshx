# Page and layout declarations

NextJsHx page and layout declarations give Haxe one typed source of truth while
preserving ordinary Next.js convention files. They exist because a plain Haxe
class cannot, by itself, prove the App Router target filename, the current
Promise-shaped props contract, or the route-specific parameter shape that Next
will independently generate.

The declaration macro validates those facts while typing Haxe and records a
closed adapter intent. It does not copy a render body, read application values,
or write `app/**`. The later renderer emits a short typed reference to the
genes-ts implementation, and Next's own route-literal helper remains the
second oracle.

## Preferred module-shaped page contract

When a route owner needs no construction, inheritance, interface, or runtime
class identity, put the annotation on a module-level `render` function:

```haxe
package app.routes;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.route.SearchParams;

typedef TodoParams = {
  final id:String;
}

/**
 * The annotation gives this ordinary module function one App Router route.
 * NextJsHx checks the route and props, then asks Genes to emit a normal named
 * JavaScript module export. It does not introduce a second routing runtime.
 */
@:next.page("todos/[id]")
function render(
  props:PageProps<TodoParams, SearchParams>
):Promise<Element> {
  return props.params.then(params ->
    <main>Todo {params.id}</main>
  );
}

/** Next consumes this as a direct named export from the same module. */
function generateStaticParams():Array<TodoParams> {
  return [{id: "first"}];
}
```

The generated implementation is an ordinary module rather than a redundant
all-static class:

```ts
export function render(
  props: PageProps<TodoParams, SearchParams>
): Promise<JSX.Element> {
  return props.params.then(params => <main>Todo {params.id}</main>);
}

export function generateStaticParams(): Array<TodoParams> {
  return [{id: "first"}];
}
```

NextJsHx then emits the same narrow convention surface a careful vanilla
Next.js page would expose:

```tsx
import {
  generateStaticParams as generateStaticParamsImplementation,
  render
} from "../../../src-gen/app/routes/TodoPage";

const NextJsHxDefault:
  (props: PageProps<"/todos/[id]">) => Promise<JSX.Element> = render;
export default NextJsHxDefault;

export async function generateStaticParams() {
  return generateStaticParamsImplementation();
}
```

The Haxe advantage is earlier route-cardinality, Promise-shaped props, HXX,
and href checking while the runtime, exports, and App Router behavior remain
ordinary Next.js. In vanilla TypeScript, the equivalent `page.tsx` functions
are already module functions; NextJsHx deliberately preserves that familiar
shape instead of asking Haxe authors to create a static namespace class.

The macro also generates a module-level `href`. Import it by field when another
Haxe module needs the link:

```haxe
import app.routes.TodoPage.href as todoHref;

final destination = todoHref({id: todo.id});
```

Static metadata stays module-shaped too:

```haxe
import nextjs.raw.metadata.Metadata;

/**
 * NextJsHx validates this against Next's public Metadata type, then asks Genes
 * to emit a normal `export const`. The annotation does not evaluate metadata or
 * introduce a second framework runtime.
 */
final metadata:Metadata = {
  title: "Todo ledger",
  description: "Typed Haxe over ordinary Next.js"
};
```

Genes emits the implementation as the direct typed binding native tools expect:

```ts
export const metadata: import("next").Metadata = {
  "title": "Todo ledger",
  "description": "Typed Haxe over ordinary Next.js"
};
```

The narrow convention adapter aliases that implementation binding before it
publishes Next's canonical named export:

```tsx
import {
  metadata as NextJsHxMetadataImplementation,
  render
} from "../../../src-gen/app/routes/TodoPage";
import type { Metadata } from "next";

const NextJsHxDefault:
  (props: PageProps<"/todos/[id]">) => Promise<JSX.Element> = render;
export default NextJsHxDefault;
export const metadata: Metadata = NextJsHxMetadataImplementation;
```

Application code must not declare `@:genes.moduleValue` itself. NextJsHx owns
the App Router export name, its type, its generated adapter, and the rule that
keeps it in the compiled program. Genes owns the reusable conversion from an
immutable Haxe module value to a normal JavaScript `export const`.
Direct user ownership fails before output with
`NXHX-PAGE-LAYOUT-MODULE-0011`.

## Compatibility class page contract

A class form remains supported when construction, inheritance, interface
implementation, class metadata, or runtime class identity makes the class
meaningful. It has one `@:next.page(path)` annotation and one public static,
non-generic `render` function:

```haxe
package app.routes;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.route.SearchParams;

typedef TodoParams = {
  final id:String;
}

@:next.page("todos/[id]")
class TodoPage {
  public static function render(
    props:PageProps<TodoParams, SearchParams>
  ):Promise<Element> {
    return props.params.then(params ->
      <main>Todo {params.id}</main>
    );
  }
}
```

`params` and `searchParams` are Promises because that is the pinned Next.js
contract. `TodoParams` is checked against `todos/[id]` by the same exact route
validator used by route handlers and hrefs. Missing, extra, or wrong-cardinality
fields fail at the render declaration before any generated files are published.

The raw `SearchParams` boundary is a readonly
`Record<string, string | string[] | undefined>` in emitted TypeScript. Haxe
allows indexed reads but deliberately exposes no indexed write. Treating URL
input as a trusted domain record is rejected. An outbound `@:next.query`
schema does not decode this input; use the semantic decoder layer before
treating incoming values as domain data.

Every page also receives an inline `href()` companion:

```haxe
final destination = TodoPage.href({id: todo.id});
```

Its return type projects to `` import("next").Route<`/todos/${string}`> ``. The
call expands at its use site, URL-encodes dynamic values, and retains neither
the page implementation nor a route helper module in a client bundle. Static
pages receive a zero-argument companion such as `RootPage.href()`.

Declaration paths preserve Next filesystem topology while companions expose
only canonical request URLs. A grouped page such as
`@:next.page("(marketing)/offers/[id]")` publishes its adapter under the group
but receives `PageProps<"/offers/[id]">` and an `/offers/...` href. An
intercepted page follows the same rule:

```haxe
@:next.page("@modal/(.)photo/[id]")
class InterceptedPhotoPage {
  public static function render(
    props:PageProps<PhotoParams, SearchParams>
  ):Element {
    return <dialog open>Photo details</dialog>;
  }
}
```

This generates `app/@modal/(.)photo/[id]/page.tsx`, but both its typed adapter
signature and `href({id: ...})` use `/photo/[id]`. The ordinary
`@:next.page("photo/[id]")` declaration remains the canonical hard-navigation
owner. The CLI rejects an intercepted view without that canonical page rather
than allowing a reload-only 404.

## Typed outbound query companion

A page may add one closed outbound query schema:

```haxe
@:structInit
class TodoQuery {
  public final page:Int;
  public final tags:Array<String>;

  public inline function new(page:Int, tags:Array<String>) {
    this.page = page;
    this.tags = tags;
  }
}

@:next.page("todos/[id]")
@:next.query(app.routes.TodoQuery)
class TodoPage {
  // render still receives raw SearchParams.
}

final destination = TodoPage.hrefWithQuery(
  {id: todo.id},
  {page: 2, tags: ["haxe next", "typed"]}
);
```

The companion validates named fields and their scalar, optional, or repeated
cardinality in Haxe, then uses native `URLSearchParams` encoding. It accepts no
arbitrary map or prebuilt search string, preserves the pathname-only `href()`,
and adds no query metadata to the adapter plan. The exact supported field and
codec contract, URL behavior, and positive and negative controls are in the
[typed-query reference](route-queries.md).

## Layout contract

A layout uses `LayoutProps<Params>`. That semantic type always includes a
React node `children` value and Promise-shaped ancestor params:

```haxe
package app.routes;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

@:next.layout("")
function render(props:LayoutProps<NoParams>):Element {
  return <html lang="en">
    <body>{props.children}</body>
  </html>;
}
```

`NoParams` is the discoverable empty shape for a root or fully static route;
it is not a broad escape type. A nested layout uses every dynamic parameter in
its annotated ancestor path.

## Native global CSS

A Haxe-owned layout can ask Next.js to load ordinary global or package CSS:

```haxe
package app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

/**
 * `@:next.css` emits a normal CSS import in this generated layout file.
 * Next.js still owns the CSS build, ordering, browser updates, and deployment.
 */
@:next.layout("") @:next.css("./globals.css")
function render(props:LayoutProps<NoParams>):Element {
  return <html lang="en">
    <body>{props.children}</body>
  </html>;
}
```

The stylesheet stays beside the generated convention file as
`app/globals.css`. NextJsHx emits this narrow adapter:

```tsx
import "./globals.css";
import { render } from "../src-gen/app/RootLayout";
import type { JSX } from "react";

const NextJsHxDefault:
  (props: LayoutProps<"/">) => JSX.Element = render;
export default NextJsHxDefault;
```

This is the same CSS mechanism used by an idiomatic vanilla Next.js layout:

```tsx
import "./globals.css";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
```

The Haxe layer improves the authoring check without replacing that mechanism.
The CSS request must be a literal `.css` path, relative files must already
exist beside the layout, duplicate imports fail at the second annotation, and
page-owned requests fail with a message directing the author to a layout. That
means these mistakes are reported at the Haxe annotation before generated
files are published. Package requests such as
`@:next.css("design-system/theme.css")` are left for Next.js to resolve against
the package's public exports.

Repeat `@:next.css(...)` to load more than one stylesheet. Authored order is
preserved because CSS order can change which rule wins. There is no generated
public copy, runtime `<link>`, or separate style watcher. When a project needs
a native placement that this safer layout-only API does not yet support, keep
that convention file native rather than weakening the typed Haxe contract.

## Typed parallel slots

A layout with named parallel routes uses a named anonymous typedef marked with
`@:next.layoutSlots`. Extend the ordinary layout contract and add exactly one
required immutable `ReactNode` field for each immediate `@slot` directory:

```haxe
import nextjs.raw.react.ReactNode;

@:next.layoutSlots
typedef RootLayoutProps = {
  > LayoutProps<NoParams>,
  final modal:ReactNode;
}

@:next.layout("")
function render(props:RootLayoutProps):Element {
  return <html lang="en">
    <body>
      {props.children}
      <div id="modal-slot">{props.modal}</div>
    </body>
  </html>;
}
```

The marker is a review boundary, not emitted runtime metadata. Haxe rejects an
unmarked lookalike, a mutable or optional slot, a non-`ReactNode` field, a
missing `children`/`params` base, or a marker with no slots using
`NXHX-PAGE-LAYOUT-SLOTS-0010`. The generated implementation remains a plain
props read, and its adapter is checked against Next's generated
`LayoutProps<"/">`, including the same `modal` slot.

Next 16 also requires an explicit `default` convention for every named slot so
hard navigation has a fallback. Pair the layout with `@:next.default("@modal")`
or a single unowned native `app/@modal/default.*`; the complete contract is in
[special-files.md](special-files.md#parallel-slot-defaults).

Both page and layout renders return exactly `genes.react.Element` or
`Promise<genes.react.Element>`. The root declaration therefore has a renderable
component contract. The required `<html>` and `<body>` behavior is verified by
the generated-adapter production fixture rather than brittle macro inspection
of application source.

## Generated plan

For the dynamic page above, the declaration plan contains the exact source
type, `render` field and metadata ranges, the segment and target paths, the
extensionless implementation import, and this default-export signature:

```ts
(props: PageProps<"/todos/[id]">) => Promise<JSX.Element>
```

The generated adapter delegates to `TodoPage.render`; it contains none of the
todo lookup, branching, markup, or other business logic in that method.

Plan validation is completed after typing, but bytes are written only after a
successful Haxe generation phase. This matters even with `--no-output`: a
normal Haxe error, such as trying to mutate `SearchParams`, cannot leave a new
empty or partial plan that tooling might mistake for a successful compile.

## Fail-closed examples

A structural lookalike does not bypass the semantic props contract:

```haxe
typedef PageLookalike = {
  final params:Promise<NoParams>;
  final searchParams:Promise<SearchParams>;
}

@:next.page("unsafe")
class UnsafePage {
  public static function render(props:PageLookalike):Element {
    return <main>unsafe</main>;
  }
}
```

This fails with `NXHX-PAGE-LAYOUT-PROPS-0005`. A page without `render`, a
layout without `children`, an unreviewed slot shape, an unvalidated query type,
a wrong route-param shape, malformed group/interception syntax, or a
non-element result fails with its own stable source-positioned diagnostic.

The names `metadata`, `generateMetadata`, `generateStaticParams`, and `segment`
have reviewed mappings. Static and generated metadata use semantic Next types;
static params must match the dynamic route exactly; and segment config accepts
only direct, version-gated literals. The detailed positive/negative examples,
supported config table, and generated adapter shape are in the
[metadata and segment-config reference](metadata-and-segment-config.md).
Arbitrary public helpers remain rejected; implementation helpers stay private.

Run the focused evidence with:

```sh
npm run test:page-layouts
npm run test:metadata-segment
```
