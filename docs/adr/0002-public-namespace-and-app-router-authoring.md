# ADR 0002: Public namespace and App Router authoring syntax

- Status: Accepted
- Date: 2026-07-16
- Decision owners: project owner and NextJsHx maintainers
- Related Beads: `nxhx-f34.1.4` (`NXHX-F04`), `nxhx-f34.4.6` (`NXHX-A06`), `nxhx-ble.2`
- Related PRD sections: 8.3, 10, 11, 12

> Component-authoring amendment: ADR 0004 supersedes the primary
> `@:next.clientComponent(path)` plus `ClientComponent.ref(Type)` ergonomics
> selected here. The namespace, per-type declaration, native adapter, and
> ownership decisions remain in force; the implementation retains this form as
> a controlled compatibility/explicit-placement path.

## Context

NextJsHx must expose two different kinds of public API without confusing them:

1. faithful Haxe bindings for supported public `next/*` entrypoints; and
2. Haxe-native declarations that describe App Router files, boundaries, and
   route contracts that do not exist as ordinary callable Next.js APIs.

The raw layer is needed because Next.js is the semantic oracle. Developers must
be able to use a supported public Next API without waiting for NextJsHx to
invent or approve an ergonomic wrapper. The semantic layer is needed because
filesystem paths, default exports, named exports, directive placement, route
parameters, and generated references are not naturally represented by raw
externs alone.

The App Router also makes the module graph part of the public contract:

- a [`page.tsx`](https://nextjs.org/docs/app/api-reference/file-conventions/page)
  default-exports a component and can be checked with the generated global
  `PageProps` helper;
- a
  [`layout.tsx`](https://nextjs.org/docs/app/api-reference/file-conventions/layout)
  default-exports a component and can be checked with `LayoutProps`;
- a
  [`route.ts`](https://nextjs.org/docs/app/api-reference/file-conventions/route)
  exposes supported uppercase HTTP methods as named exports and can be checked
  with `RouteContext`;
- a Client Component boundary puts
  [`"use client"`](https://nextjs.org/docs/app/getting-started/server-and-client-components)
  above imports; and
- a dedicated Server Function module puts
  [`"use server"`](https://nextjs.org/docs/app/api-reference/directives/use-server)
  above imports and exports async functions.

ADR 0001 selects deterministic generated adapters as the initial bridge to
those contracts. This ADR selects the author-facing names and declarations
that produce adapter intent. It does not change adapter ownership,
publication, or validation rules.

The syntax must satisfy these competing needs:

- preserve a faithful, versioned escape hatch;
- keep ordinary Next.js terms recognizable;
- make route and boundary intent visible in Haxe source;
- preserve strict Haxe and generated TypeScript types;
- avoid a manually duplicated central route list;
- avoid importing server implementations into client output;
- remain compatible with mixed native TypeScript and Haxe ownership;
- give later macros deterministic declarations to validate.

## Decision

### Namespace split

The public namespace is divided by responsibility:

| Haxe namespace | Responsibility | Compatibility contract |
| --- | --- | --- |
| `nextjs.raw.*` | Faithful façades over allowlisted public Next.js and platform entrypoints | Tracks the selected upstream public signature, subject only to documented Haxe representation limits |
| `nextjs.*` | Supported semantic types, helpers, metadata, codecs, and macro-backed references | NextJsHx public API with normal project stability rules |
| `nextjs._internal.*` | Supporting declaration types needed to express public bindings | Hidden from completion and documentation; no semver compatibility promise |
| `nextjshx.*` | CLI, compiler, renderer, manifest, and build implementation | Tooling-internal unless a specific symbol is separately documented |

Application code remains in application-owned packages such as `app.routes`,
`app.components`, `app.actions`, and `app.domain`. It must not place
application types under `nextjs.*` or `nextjshx.*`.

The `@:next.*` metadata prefix is authoring syntax, not another Haxe package.
Metadata is consumed at compile time and does not produce a `next` runtime
object.

### Faithful raw escape hatch

`nextjs.raw.*` exposes only reviewed public module entrypoints. Each façade
records its exact JavaScript module specifier, export kind, upstream signature,
Haxe name, stability, and evidence fixture in the public-surface allowlist.

For example, a raw navigation façade may be used directly:

```haxe
package app.auth;

import nextjs.raw.Navigation;
import nextjs.raw.navigation.Never;

class RequireSession {
  public static function redirectToLogin():Never {
    return Navigation.redirect("/login");
  }
}
```

The relevant generated TypeScript shape remains a public Next.js import:

```ts
import * as Navigation from "next/navigation";

export function redirectToLogin(): never {
  return Navigation.redirect("/login");
}
```

The Haxe façade may normalize an identifier that Haxe cannot spell directly,
but it must not add a hidden runtime protocol, change the import to
`next/dist/**`, weaken a type to `Dynamic`, or silently narrow behavior.

Semantic helpers under `nextjs.*` may delegate to the raw layer. They must
remain thin and must document every intentional narrowing. A developer may
drop from a semantic helper to the corresponding supported raw façade at the
same call site.

### Per-type App Router declarations

One annotated application class declares one Next convention module or
boundary. The class-level metadata selects the adapter kind and target. Static
fields select the implementation exports.

The accepted syntax is:

| Haxe declaration | Generated target relative to the detected App Router root | Export contract |
| --- | --- | --- |
| `@:next.page("todos/[id]")` | `todos/[id]/page.tsx` | default component plus reviewed page named exports |
| `@:next.layout("")` | `layout.tsx` | default component plus reviewed layout named exports |
| `@:next.loading("todos")` | `todos/loading.tsx` | default zero-argument server component |
| `@:next.error("todos")` | `todos/error.tsx` | `"use client"` plus a default component with exact Error/reset props |
| `@:next.notFound("todos")` | `todos/not-found.tsx` | default zero-argument server component |
| `@:next.route("api/todos/[id]")` | `api/todos/[id]/route.ts` | named HTTP method exports |
| `@:next.clientComponent("todos/_components/TodoToggle")` | `todos/_components/TodoToggle.tsx` | `"use client"` plus a default component |
| `@:next.serverFunctions("todos/actions")` | `todos/actions.ts` | `"use server"` plus named async functions |

The path argument is a compile-time string using `/` separators. It is relative
to the discovered `app/` or `src/app/` root and therefore:

- has no leading slash;
- has no `app/` or `src/app/` prefix;
- omits `page`, `layout`, `route`, or another special filename;
- omits the file extension;
- uses `""` for the root segment;
- is normalized and validated before any adapter is rendered.

Absolute paths, backslashes, empty interior segments, `.` or `..`, malformed
dynamic segments, unsupported route syntax, and reserved generated locations
are rejected. The class package and name provide source identity and
diagnostics; they do not implicitly determine the public URL.

A class has exactly one boundary-kind annotation. App Router declaration
classes use public static fields and do not require instantiation. Business
logic may delegate to application services, but the declaration remains the
typed entrypoint that the adapter invokes.

### Page declaration

A page class:

- has `@:next.page(segmentPath)`;
- exposes one public static `render` function;
- uses a typed semantic `PageProps<Params, Query>` contract;
- may expose only reviewed page fields such as `segment`, `metadata`,
  `generateMetadata`, and `generateStaticParams`;
- receives a generated per-route `href` companion;
- is a Server Component by default.

Representative Haxe:

```haxe
package app.routes;

import genes.js.Async.await;
import genes.react.Element;
import nextjs.Navigation;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.route.SearchParams;

typedef TodoPageParams = {
  final id:String;
}

@:next.page("todos/[id]")
class TodoPage {
  public static final segment = SegmentConfig.create({
    revalidate: 60
  });

  @:async
  public static function render(
    props:PageProps<TodoPageParams, SearchParams>
  ):Promise<Element> {
    final params = await(props.params);
    final todo = await(Todos.find(params.id));

    if (todo == null) {
      Navigation.notFound();
    }

    return <TodoView todo={todo} />;
  }
}
```

Representative generated adapter:

```tsx
// Generated by NextJsHx. Source: app.routes.TodoPage. Do not edit.
import { TodoPage } from "../../../../src-gen/app/routes/TodoPage";

export const revalidate = 60;

export default function Page(props: PageProps<"/todos/[id]">) {
  return TodoPage.render(props);
}
```

The Haxe macro checks `TodoPageParams` against the declared segment. The
adapter deliberately uses Next's generated route-literal helper as an
independent TypeScript oracle.

The route reference belongs to the page declaration:

```haxe
final href = TodoPage.href({id: todo.id});
Navigation.redirect(href);
```

`href` is an inline or macro-backed value that encodes all parameters. It must
not force the page implementation into a client bundle.

### Layout declaration

A layout class:

- has `@:next.layout(segmentPath)`;
- exposes one public static `render` function;
- receives typed `children`, ancestor parameters, and later supported slots
  through `LayoutProps`;
- may expose reviewed metadata, static-parameter, and segment-config fields;
- is a Server Component by default.

Representative root layout:

```haxe
package app.routes;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

@:next.layout("")
class RootLayout {
  public static function render(
    props:LayoutProps<NoParams>
  ):Element {
    return <html lang={"en"}>
      <body>{props.children}</body>
    </html>;
  }
}
```

Representative generated adapter:

```tsx
// Generated by NextJsHx. Source: app.routes.RootLayout. Do not edit.
import { RootLayout } from "../../src-gen/app/routes/RootLayout";

export default function Layout(props: LayoutProps<"/">) {
  return RootLayout.render(props);
}
```

`NoParams` is the semantic empty route-parameter type; it is not `Dynamic`.
Root-layout HTML/body behavior is proven by the real fixture and Next build,
not by string matching the Haxe source.

### Metadata, static params, and segment-config amendment

On 2026-07-17, `nxhx-f34.4.7` amended this decision to implement the previously
reserved `metadata`, `generateMetadata`, `generateStaticParams`, and `segment`
fields. While developing the stable consumer, a Haxe-owned route that needed
these ordinary Next capabilities still required a native TypeScript convention
file. That split duplicated route ownership, and a generic config passthrough
would have hidden syntax-level literals from Next's plugin or deferred invalid
values until the framework build.

The amendment therefore accepts:

- exact static `Metadata`, or a mutually exclusive typed `generateMetadata`;
- common Promise-shaped `MetadataProps` for pages/layouts and page-only
  `PageMetadataProps` when query input is required;
- zero-argument `generateStaticParams` returning a synchronous or Promise array
  whose element type exactly matches the dynamic route; and
- compile-time-only `SegmentConfig.create({...})` with the reviewed stable
  `runtime`, `preferredRegion`, `dynamicParams`, `revalidate`, and
  `maxDuration` literals.

The segment marker is removed before genes-ts generation. The adapter plan
stores only tagged data, and the host emits direct `export const` literals under
an exact Next 16.2.12 version gate. Next typegen, strict TypeScript, the Next
plugin, and `next build` remain independent oracles; this is an authoring layer,
not a config runtime. Invalid route shapes, structural metadata props,
conflicting metadata sources, runtime expressions, experimental values, and
unknown fields fail before publication. The detailed contract and positive and
negative examples are in the
[metadata and segment-config reference](../metadata-and-segment-config.md).

### Loading, error, and not-found amendment

On 2026-07-17, `nxhx-f34.4.6` amended this accepted decision to add exact
loading, error, and not-found annotations. While building the stable Next
consumer, these boundaries exposed a Haxe-specific ergonomics gap: a native
bridge required authors to duplicate convention filenames and TypeScript
module semantics, while `error.tsx` additionally required a first-position
`"use client"` directive and an exact `Error & { digest?: string }` /
`reset: () => void` contract. Leaving the three files native would make a
common App Router path less safe and less discoverable than the page/layout
layer without adding useful runtime flexibility.

The amendment therefore accepts three narrow declarations:

- `@:next.loading(path)` and `@:next.notFound(path)` each require a public
  zero-argument module `render`, or the compatible static class form, returning
  `Element` or `Promise<Element>`; both remain Server Components;
- `@:next.error(path)` requires a synchronous public module `render`, or the
  compatible static class form, accepting semantic `nextjs.app.ErrorProps` and
  returning `Element`; and
- the renderer derives the exact filename and one default export, while the
  error adapter automatically begins with `"use client"`.

This is an authoring improvement, not a parallel boundary runtime. Next still
owns streaming, error capture and reset, not-found selection, hydration, and
HTTP status. Strict generated TypeScript and `next build` remain independent
oracles. A structural error-props substitute, asynchronous error render,
unexpected public export, wrong result, edited target, or missing directive
fails before publication. The full positive and negative examples are in the
[special-file reference](../special-files.md), and the production fixture
proves streamed loading, a hydrated HTTP 404, and browser-driven error reset.

### Module-level special-file owner amendment

On 2026-08-01, `nxhx-f34.9.9.2` removed the remaining namespace-only class from
the normal special-file authoring path. A public, non-generic module-level
`render` may now carry `@:next.loading`, `@:next.error`, `@:next.notFound`, or
`@:next.default`. This matches the familiar JavaScript/TypeScript pattern: the
source module exports a component function, and no runtime class exists unless
the application actually needs class identity.

NextJsHx validates the Next-specific path, props, result, and client/server
rules first, then asks Genes to emit the already-checked Haxe function as a
direct ES module export. The generated Next adapter imports that function and
keeps the same canonical default export. In particular, an error adapter still
starts with `"use client"`; using a module function does not change Next's
browser boundary or recovery behavior.

The original one-static-method class form remains supported for compatibility
and for the unusual case where a class has real meaning. Directly adding the
lower-level Genes export marker is rejected here because it could bypass the
special-file checks. Focused exact-error tests protect that rule, while the
maintained blog, commerce, and Todo applications prove real Next builds,
not-found responses, streamed loading, and browser error recovery.

### Route Handler declaration

A Route Handler class:

- has `@:next.route(segmentPath)`;
- exposes public static functions marked with exactly one supported uppercase
  method metadata entry;
- uses a faithful `Request` or `NextRequest` type and a semantic typed
  `RouteContext<Params>`;
- returns `Response` or a strictly compatible async response;
- may expose only route-handler-valid config.

Representative Haxe:

```haxe
package app.api;

import genes.js.Async.await;
import nextjs.raw.server.NextRequest;
import nextjs.raw.server.WebResponse;
import nextjs.route.RouteContext;

typedef TodoRouteParams = {
  final id:String;
}

@:next.route("api/todos/[id]")
class TodoRoute {
  @:next.GET
  @:async
  public static function get(
    request:NextRequest,
    context:RouteContext<TodoRouteParams>
  ):Promise<WebResponse> {
    final params = await(context.params);
    return ResponseJson.ok(Todos.find(params.id), TodoCodec);
  }

  @:next.DELETE
  @:async
  public static function delete(
    request:NextRequest,
    context:RouteContext<TodoRouteParams>
  ):Promise<WebResponse> {
    return TodoAuthorization.delete(request, context);
  }
}
```

Representative generated adapter:

```ts
// Generated by NextJsHx. Source: app.api.TodoRoute. Do not edit.
import type { NextRequest } from "next/server";
import { TodoRoute } from "../../../../src-gen/app/api/TodoRoute";

export function GET(
  request: NextRequest,
  context: RouteContext<"/api/todos/[id]">
) {
  return TodoRoute.get(request, context);
}

export function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/todos/[id]">
) {
  return TodoRoute.delete(request, context);
}
```

The metadata controls the exported HTTP name; the Haxe method may use normal
lower-camel naming. Duplicate method metadata, repeated HTTP exports, unsupported
methods, page props, or decoded request bodies without an explicit decoder fail
validation.

### Client Component declaration and reference

A client boundary class:

- has `@:next.clientComponent(adapterPath)`;
- exposes one public static `render(props)` function;
- has a concrete serializable props type;
- does not also declare a page, layout, route, or Server Function boundary.

Representative Haxe:

```haxe
package app.components;

import genes.react.Element;
import nextjs.client.ClientComponent;

typedef TodoToggleProps = {
  final todoId:String;
  final initialDone:Bool;
}

@:next.clientComponent("todos/_components/TodoToggle")
class TodoToggle {
  public static function render(props:TodoToggleProps):Element {
    return <button onClick={() -> TodoClient.toggle(props.todoId)}>
      {props.initialDone ? "Done" : "Open"}
    </button>;
  }
}
```

Representative generated boundary:

```tsx
"use client";

// Generated by NextJsHx. Source: app.components.TodoToggle. Do not edit.
import { TodoToggle } from "../../../../src-gen/app/components/TodoToggle";

export default function TodoToggleBoundary(
  props: Parameters<typeof TodoToggle.render>[0]
) {
  return TodoToggle.render(props);
}
```

Server-authored Haxe code refers to the boundary through the canonical
macro-backed handle:

```haxe
final Toggle = ClientComponent.ref(TodoToggle);
return <Toggle todoId={todo.id} initialDone={todo.done} />;
```

`ClientComponent.ref(TodoToggle)` produces a typed component import from the
generated `"use client"` adapter, keeps the genes implementation reachable for
Haxe DCE, and never imports the raw client implementation into the server
module. It is compile-time authoring syntax, not a runtime component registry.

### Server Function declaration and reference

A dedicated Server Function class:

- has `@:next.serverFunctions(adapterPath)`;
- marks each exported public static async function with `@:next.action`;
- keeps unmarked helpers private or implementation-only;
- uses the native React/Next Server Function transport;
- performs application-owned authentication, authorization, validation, and
  mutation inside the server implementation.

Representative Haxe:

```haxe
package app.actions;

import nextjs.action.ActionResult;

@:next.serverFunctions("todos/actions")
class TodoActions {
  @:next.action
  @:async
  public static function createTodo(
    formData:FormData
  ):Promise<ActionResult<Todo>> {
    return TodoMutations.create(formData);
  }
}
```

Representative generated boundary:

```ts
"use server";

// Generated by NextJsHx. Source: app.actions.TodoActions. Do not edit.
import { TodoActions } from "../../../src-gen/app/actions/TodoActions";

export async function createTodo(
  formData: Parameters<typeof TodoActions.createTodo>[0]
): Promise<Awaited<ReturnType<typeof TodoActions.createTodo>>> {
  return TodoActions.createTodo(formData);
}
```

A client or server component imports the action boundary through:

```haxe
final createTodo = ServerFunction.ref(TodoActions.createTodo);
return <form action={createTodo}>
  <input name={"title"} />
  <button type={"submit"}>Create</button>
</form>;
```

`ServerFunction.ref(TodoActions.createTodo)` preserves the function signature
while importing the generated `"use server"` export. It does not introduce an
RPC envelope, client-supplied secret, or raw implementation import.

Dedicated module-level Server Functions are the initial stable syntax.
Function-body directives for inline actions require separate generic compiler
support and evidence.

### Fixed field conventions and compile-time metadata

The initial model intentionally has a small export vocabulary:

- `render` is the implementation selected for a page, layout, loading, error,
  not-found, or client component default export;
- `@:next.GET`, `@:next.POST`, `@:next.PUT`, `@:next.PATCH`,
  `@:next.DELETE`, `@:next.HEAD`, and `@:next.OPTIONS` select Route Handler
  named exports;
- `@:next.action` selects a same-named Server Function export;
- reviewed exact field names select supported Next named exports such as
  `metadata`, `generateMetadata`, and `generateStaticParams`;
- `segment = SegmentConfig.create({...})` supplies compile-time literal segment
  configuration and disappears from runtime output.

The macro rejects accidental public fields that look exportable but have no
supported mapping. Arbitrary emitted TypeScript strings, arbitrary export-name
strings, and user-controlled directive strings are not part of this API.

### No manually maintained route registry

The annotated application type is the route or boundary declaration. Users do
not also add it to `Routes.hx`, a JSON route list, or a runtime router.

The toolchain must discover annotated types under configured application source
roots and make them available to the Haxe compilation without requiring dummy
imports solely for registration. The exact project-discovery configuration is
owned by `NXHX-T01`; the invariant is that discovery is deterministic and does
not create a second author-maintained source of truth.

During typing, each declaration registers one deterministic adapter intent.
After typing:

1. duplicate filesystem targets and conflicting public route patterns fail;
2. every route parameter typedef is checked against its segment path;
3. per-route references are generated from the declaration;
4. the adapter plan and route manifest are sorted and emitted for tooling;
5. adapters are rendered and published under ADR 0001's ownership rules.

An optional aggregate `AppRoutes` façade may be generated from the validated
manifest for discovery or TypeScript interop. It is derived output and can
never become a list developers must update by hand.

Native TypeScript routes coexist by file ownership. NextJsHx does not need a
semantic declaration for a native route, and it does not infer authority to
replace one.

### App Router topology amendment (2026-07-20)

The accepted declaration grammar now distinguishes an adapter's filesystem
topology from its canonical request URL. This amends the initial conservative
deferral after focused Haxe fixtures, generated-adapter snapshots, CLI
collision controls, strict Next type generation, a production build, and a
browser navigation proof established the following contract:

- named `(group)` and `@slot` segments remain in the generated filesystem
  target but are omitted from the public URL;
- `(.)`, `(..)`, `(..)(..)`, and `(...)` attach directly to one target segment
  and resolve by URL-segment depth, not raw directory depth;
- every route has one explicit topology role: canonical owner, parallel view,
  or intercepted soft-navigation view;
- intercepted views expose the canonical target through `PageProps` and
  `href()`, require a canonical hard-navigation page, and cannot collide with
  another view at the same slot/source/target identity;
- a named `@:next.layoutSlots` props typedef extends `LayoutProps<Params>` with
  required immutable `ReactNode` fields; and
- `@:next.default("path/@slot")` owns the corresponding `default.tsx`, while
  CLI preflight accepts exactly one Haxe or native default for every slot.

These are compile-time ownership and typing rules over ordinary Next App
Router files. They introduce no router, modal manager, slot registry, or
runtime helper.

### Explicitly deferred syntax

The following are outside the currently accepted authoring syntax:

- Pages Router pages and legacy data functions;
- custom `pageExtensions` inventory and generation;
- Edge Runtime compatibility qualification beyond accepting Next's stable
  `runtime: "edge"` segment literal;
- instrumentation, metadata-route, image-generation, `template`,
  `global-error`, `forbidden`, and `unauthorized` authoring annotations;
- directly client-marked page or layout declarations;
- inline function-body Server Functions;
- automatic route-parameter typedef synthesis;
- automatic inbound search-parameter decoding beyond the raw `SearchParams`
  contract;
- arbitrary named export aliases or directive strings;
- experimental cache directive variants;
- a user-maintained aggregate route declaration.

These features require their own Beads, diagnostics, snapshots, Next typegen,
strict TypeScript, build, and runtime evidence. Native TypeScript remains the
supported ownership escape hatch while a convention lacks Haxe syntax.

## Consequences

Positive consequences:

- Developers can distinguish a faithful Next binding from a NextJsHx semantic
  convenience by its import path.
- App Router intent is visible beside the Haxe implementation.
- Each source class maps to one reviewable native adapter.
- Next route literals remain present in generated TypeScript as a second type
  oracle.
- Client and Server Function consumers import the correct generated boundary
  without learning adapter paths.
- Route references are local to their declarations instead of depending on a
  central manually synchronized registry.
- Native TypeScript files remain a first-class escape hatch and coexist at
  file-level ownership.
- Later generic genes-ts directive/export support can simplify adapter bytes
  without changing the public declaration model.

Costs and constraints:

- The public API has both raw and semantic namespaces that must be documented
  clearly.
- Metadata and fixed field names form a compiler-facing language and therefore
  require stable diagnostics and compatibility discipline.
- The toolchain must discover otherwise unreferenced annotated types without
  requiring registration imports.
- Macro-backed client and action references must coordinate imports and Haxe
  DCE precisely.
- Adding a special file or export is an explicit product change rather than an
  arbitrary string escape.
- Some valid but unmodeled Next.js structures remain native TypeScript until
  their Haxe model is proven.

No decision here authorizes a custom runtime, router, RPC protocol, or broad
type cast. Generated modules remain ordinary Next.js and React modules.

## Rejected alternatives

### Raw externs only

Raw externs faithfully expose callable Next APIs, but they cannot by themselves
select `app/**` paths, create default or named exports, place directives, build
typed route references, or publish collision-safe convention files. Requiring
developers to hand-write every adapter would leave the core App Router product
outside the Haxe API.

### Semantic wrappers only

Hiding the raw public surface would make every unsupported ergonomic wrapper a
framework blocker and would encourage duplicated or distorted Next semantics.
It would also make declaration drift harder to diagnose. The semantic layer is
additive; it does not replace the faithful layer.

### Central manually maintained route registry

A central `Routes.hx`, JSON list, or runtime table would duplicate the path
already declared by each route class. It could drift, creates ordering and
two-pass typing problems, and conflicts with gradual adoption of native routes.
A generated manifest or aggregate façade is useful evidence; an
author-maintained registry is rejected.

### Filesystem path derived only from Haxe packages

Automatically mapping `app.routes.todos.TodoPage` to a route would couple
ordinary refactors to public URLs, make route groups and dynamic segments
awkward, and hide a security-relevant write target. The adapter-relative path
is explicit metadata and is validated independently of the Haxe package.

### Runtime routing DSL or component base classes

A runtime DSL or inheritance hierarchy would duplicate App Router behavior,
obscure server/client module graphs, and add runtime machinery that Next does
not require. Compile-time metadata and typed static entrypoints disappear into
native adapter modules.

## Change process

Changes to public namespace responsibility, accepted metadata, target-path
meaning, field-to-export mapping, or boundary-reference behavior require an
amending or superseding ADR linked to the responsible Bead. Adding a feature
from the deferred list requires exact Haxe and generated TypeScript snapshots,
negative compile fixtures, and a real pinned-Next validation lane.

Documentation and examples must identify raw versus semantic imports. An
implementation must not quietly add arbitrary export strings, fall back to
`Dynamic`, introduce a central route list, or import a raw client/server
implementation when a generated boundary reference is required.
