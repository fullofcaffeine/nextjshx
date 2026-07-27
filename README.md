# NextJsHx

NextJsHx is a Next.js-first framework layer for authoring Next.js applications
and reusable modules in typed Haxe. Haxe compiles to strict TypeScript/TSX
through `genes-ts`; narrow generated adapters materialize the exact filenames,
directives, and export shapes required by the App Router.

This repository is in foundation work. It has no supported release yet, and its
public API, package shape, and compatibility matrix are not final.

## Why NextJsHx?

NextJsHx keeps the Next.js runtime and ecosystem while moving application
authoring into Haxe's closed type system. The semantic layer catches route,
prop, Hook, server/client, serialization, and generated-file ownership errors
at their Haxe source positions. The raw layer remains available when exact
Next.js compatibility is more important than added ergonomics.

Use it to:

- author App Router pages, layouts, Route Handlers, Client Components, Server
  Functions, cache boundaries, Hooks, and reusable modules in Haxe;
- consume existing TypeScript, JavaScript, React, and Next.js modules through
  precise externs;
- export Haxe-authored components and Hooks back to ordinary TSX without a
  parallel runtime; and
- generate small, deterministic adapters that look like handwritten Next.js.

Start with the [flagship todo app](examples/todoapp-next) for a complete
production architecture, the [showcase guide](docs/showcases.md) for focused
sites, or [mixed-language adoption](docs/mixed-language-adoption.md) for an
existing Next.js application. The [documentation map](docs/README.md) groups
the deeper references by task.

## Bootstrap

Prerequisites:

- Node.js `20.9.0` or `24.18.0` for release-blocking repository evidence;
  `20.19.3` remains the reviewed development baseline
- Haxe `4.3.7`
- Haxe formatter `1.18.0`
- Gitleaks `8.30.0`
- Beads (`bd`), `jq`, Git, and Python 3

```sh
npm ci --ignore-scripts
npx --no-install lix download
npx --no-install haxelib install formatter 1.18.0 --quiet
npm run hooks:install
bd prime
npm test
```

For normal work, let the local gates scale with cost:

```sh
git commit                    # staged formatting, hygiene, and leak checks
git push                      # history scans plus the medium compiler/package gate
npm run public:preflight      # complete local release and publication evidence
```

GitHub Actions runs the complete test harness, both supported Node versions,
Turbopack and webpack production builds, maintained showcases, the flagship
Playwright suite, dependency auditing, declaration drift, and full-history
secret scanning. The Next.js canary drift lane is deliberately informative;
stable compatibility lanes are blocking.

The current root test validates the imported implementation plan, compatibility
contract, repository security tooling, deterministic adapter-plan schema,
closed route-pattern and params contract, typed Haxe page/layout declarations,
validated Haxe Route Handler named exports, ergonomic typed route-href
expansion, typed loading/error/not-found declarations, exact JSON/form/query
decoding, typed JSON responses, direct component imports, async
request/cache/server parity, typed Client Component boundaries, conservative
prop serializability, typed React Hook/`use` placement and local render-purity
diagnostics, allocation-free semantic state/memo Hooks, bidirectional
Haxe/TypeScript Hook exports, native typed Server Functions and action refs, guarded
request-local authorization with public-result projection, direct form policy
controls, and the stable Next.js build/runtime fixture. It also
builds and drives the maintained todo app through isolated file persistence,
generated list/detail routes, typed Haxe Client Components, native Server
Function create/toggle/delete, accessible pointer/keyboard sorting through a
typed dnd-kit facade, shareable URL-owned discovery state, a resettable Haxe
error boundary, a keyboard-first typed command desk, real status-grouped
List/Board views, a typed Recharts priority runway with an accessible data
table, and fourteen zero-retry
Playwright journeys against isolated production servers. Browser
console errors, hydration diagnostics, request failures, and unexpected HTTP
failures are blocking. The Cache Components lane also proves exact
module/function directives, conservative Haxe cache values, a strict
production build, cache-key reuse, and tag invalidation.

## Maintained showcase sites

Four polished sites exercise NextJsHx as an application-authoring surface:
Pelagic Signal (landing page plus hydrated tide instrument), Moraine (typed
generated-static field journal), and Common Ground (typed product routes,
optimized images, filtering, and cart Sheet), plus Field Atlas (trusted local
MDX, typed Haxe components, and safely decoded portable content blocks). They
reuse one source-owned shadcn/Radix package through precise Haxe facades.

```sh
npm run test:showcase-ui
npm run test:showcases
```

The full command compiles every site twice for byte determinism, runs strict
TypeScript and Next production builds, verifies expected static routes, drives
desktop and mobile Chrome interactions, and cleans only generated/owned output.
The [showcase guide](docs/showcases.md) explains where Haxe owns application
behavior and which surface each site covers. The focused
[Radix and shadcn guide](docs/radix-shadcn.md) documents the native-source
boundary, exact `Slot` / `asChild` child contracts, emitted TSX, and production
focus/keyboard evidence.

## Mixed-language gradual adoption

[Patchbay 06](examples/mixed-adoption) starts from native TypeScript App Router
routes, components, a custom Hook, and an ordinary module. It demonstrates
both directions of precise interop while keeping native and Haxe-owned routes
under separate manifest-safe ownership:

```sh
npm run test:example:mixed-adoption
```

The lane proves `nextjshx init` preserves native bytes, Haxe consumes native
TSX/Hook/module exports through zero-runtime closed externs, native TSX consumes
a Haxe component, generic Hook, and named function, invalid Server/Client
crossings fail, and the production UI hydrates at desktop and mobile widths.
See the [scenario guide](docs/mixed-language-adoption.md).

## Compatibility contract

[support_matrix.json](support_matrix.json) is the machine-readable source of
truth for exact toolchain, framework, and evidence-lane identities. Its
human-readable view is generated at
[docs/compatibility.md](docs/compatibility.md).

```sh
npm run test:support-matrix
npm run support:discover
npm run drift:next:stable
npm run drift:next:upstream
```

The stable drift command is release-blocking and must reproduce the checked
surface and binding IR exactly. The upstream command renders a separate
classified JSON/Markdown report from the configured read-only source checkout
or exact canary package; it never rewrites the stable baseline and remains an
early-warning lane. Discovery optionally validates
read-only genes-ts and Next.js source checkouts, reports missing checkouts
without failing the stable-package lane, and accepts explicit paths through
`NEXTJSHX_GENES_TS_DIR` and `NEXTJSHX_NEXT_UPSTREAM_DIR`. Use
`npm run support:require-genes` or `npm run support:require-upstream` only when
running those source-oracle lanes. CI supplies the exact canary package through
`NEXTJSHX_NEXT_PACKAGE_DIR`; local source evidence uses the configured checkout
after its `packages/next` declarations have been built.

## Curated Next.js surface

NextJsHx does not expose every declaration shipped by Next.js. The reviewed
[public-entrypoint allowlist](config/next-public-entrypoints.json) selects 17
P0/P1/P2 entrypoints and 68 exports from the exact Next 16.2.12 package, plus
the pinned Web `Request`/`Response` contracts. Its generated
[normalized manifest](surface/next-public-surface.json) records signature
hashes and keeps 62 current `next/dist/**` declaration origins explicitly
outside the compatibility and runtime-import promises.

```sh
npm run surface:next:check
npm run test:next-surface
npm run bindings:next:check
npm run test:next-bindings
npm run test:next-drift
npm run test:next-core-navigation
npm run test:next-components
npm run test:next-server
```

Maintainers use `npm run surface:next:update` only after reviewing an upstream
or allowlist change; updates are disabled in CI. The exact module/export table,
hash algorithm, internal-type boundary, intentional font narrowing, and
positive/negative examples are documented in the
[public binding inventory](docs/binding-policy.md).

The declaration pipeline ingests the 78 exact declaration nodes behind those
exports into a versioned [binding IR](surface/next-binding-ir.json), applies a
small signature-pinned safety override set, and emits a classified
[drift report](surface/next-surface-drift.md). Its B02 bootstrap generates the
provable closed `ServerRuntime` union. B03 adds 20 signature-locked core and
navigation exports across 14 Haxe source files. B04 adds all 18 selected Link,
Image, Form, dynamic-component, Script, and font exports across 20 more files,
and B05 adds all 27 P0 Web, headers, cache, and server exports across 21 more
files. The manifest now records 65 curated exports and one generated export;
only the reviewed P2 `next/og.ImageResponse` and
`next/web-vitals.useReportWebVitals` exports remain explicitly pending. The
reviewed
[implementation manifest](config/next-binding-implementations.json) ties every
curated export to its exact upstream signature, source output, owner, and
strict fixture. Unsupported TypeScript constructs stop before Haxe emission,
and changed baselines require an exact reviewed transition. Maintainers use
`npm run bindings:next:update` only after that review; it is disabled in CI.
The compatibility harness projects candidate declarations through the same
binding ownership and fixture map, so a private declaration move remains
compatible while a removed export, changed kind, or changed signature reports
the exact owning Bead and regression fixture.

The B03 raw layer covers the root Next configuration, metadata, viewport, and
route types; the reviewed `next/navigation` hooks and control-flow interrupts;
and the nullable `next/compat/router` migration hook. It keeps runtime imports
on public module entrypoints, emits exact `never` return types, removes
search-param mutation methods that Next rejects at runtime, and exposes only
the stable one-argument `prefetch` form because Next 16.2.12's optional options
leak a non-public enum. Haxe gets closed redirect literals and target-inferred
parameter records while strict TypeScript remains the final oracle for the
large open Next object graphs. The exact tradeoffs and positive/negative
examples are documented in the
[public binding inventory](docs/binding-policy.md).

The B04 component layer emits the real default and named imports from
`next/link`, `next/image`, `next/form`, `next/dynamic`, `next/script`, and
`next/font/*`; it adds no wrapper runtime. Required href, image alt, form
action, closed prop literals, font subsets/axes, and CSS-variable result shapes
are visible while authoring Haxe. Strict emitted-TSX checks remain the final
oracle. HXX authors use the semantic `nextjs.components.NextLink`, `NextImage`,
`NextForm`, and `NextScript` values, which preserve the same public Next imports
while avoiding ambiguity with intrinsic HTML tags; exact prop types remain in
`nextjs.raw.components.*`. The Haxe API also uses `DynamicComponent.load`,
`nextjs.raw.lazy.*`, and lower-camel `Google.inter`/`Google.roboto`, because the
original planned `Dynamic`/`dynamic` paths collide with Haxe language names and
upper-camel method names are unidiomatic in Haxe.

The B05 server layer emits direct imports from `next/headers`, `next/cache`,
and `next/server`. Async cookies, headers, draft mode, and `connection` retain
their pinned Promise contracts. Cookie reads are mutation-free by default;
Route Handlers and Server Actions opt into the same public `cookies` export via
the explicit `Headers.mutableCookies()` Haxe name. Cache profiles and path
scopes are discoverable closed values, while configured custom profiles require
an explicit `CacheLifeProfile.custom(name)` call. `NextRequest`,
`NextResponse`, proxy/middleware matchers, `URLPattern`, user-agent helpers,
and Web Request/Response values stay runtime-native. Their JSON methods use an
explicit `genes.ts.Unknown` decode boundary instead of Haxe 4.3.7's inherited
`Dynamic`; locally created `NextResponse.json(value)` responses retain the
value type. The strict fixture includes a negative control proving that the
unmodified upstream `NextRequest.json()` type still permits an unchecked
string claim, then proves the safe Haxe projection rejects the same claim.

## Haxe Cache Components

Standalone `@:next.cache("path")` classes expose public static async functions;
consumers call their precise generated boundary through
`CacheFunction.ref(Owner.method)`. The directive stays inside each native async
wrapper, so unrelated exports are not cached. A page or layout instead uses a
zero-argument `@:next.cache` modifier, which places the directive at byte zero
of its generated convention module.

Shared Cache Components require explicit matching NextJsHx and native Next
configuration. Experimental private and remote directives require separate
named capabilities. The Haxe layer rejects synchronous functions, unsafe
paths, broad/class/function values, known direct request-API use in shared or
remote scopes, and raw implementation edges. Next remains the final graph and
runtime oracle. The full positive/negative contract, generated shapes,
security limits, and invalidation guidance are in the
[Cache Components reference](docs/cache-components.md).

```sh
npm run test:cache-boundaries
```

## Haxe pages and layouts

`@:next.page(path)` and `@:next.layout(path)` declarations require one public
static `render` function with semantic `PageProps<Params, SearchParams>` or
`LayoutProps<Params>`. The macro checks Promise-shaped inputs, exact dynamic
route params, React children, and synchronous or Promise element results, then
records only the implementation reference and exact Next route-literal
signature. Page classes receive their typed, inline `href()` companion
automatically; call sites do not retain the server page implementation.
Route groups, named parallel slots, and all four interception markers retain
their exact filesystem ownership while generated props and hrefs use the
canonical request URL. Slotted layouts declare required immutable React-node
fields with `@:next.layoutSlots`; every slot has one checked Haxe or native
`default` convention for hard-navigation fallback.

Search parameters are a faithful readonly raw URL-input record, not a trusted
domain value. Structural props lookalikes, mutation, wrong query/params types,
missing renders, incompatible results, and unreviewed public exports all fail
before plan publication. The complete contract and positive/negative examples
are in the [page/layout reference](docs/pages-and-layouts.md).

A page may also declare `@:next.query(QueryType)`. This keeps incoming
`SearchParams` raw while adding a typed `hrefWithQuery()` companion for closed
required, optional, repeated, renamed, and domain-encoded outbound fields. It
uses native `URLSearchParams`, preserves the original pathname-only `href()`,
and accepts neither arbitrary maps nor prebuilt search strings. See the
[typed-query reference](docs/route-queries.md).

`nextjshx routes --check` reports Haxe-owned adapters and native App Router
pages/Route Handlers together, with explicit origin, exact file ownership,
normalized public patterns, topology role, slot/interception identity,
parameter cardinality, and Next typegen parity. A native route remains unowned.
Malformed topology, duplicate canonical/view ownership, an intercepted view
without its canonical page, or a slot without exactly one default fails closed;
see the
[typed-route reference](docs/route-hrefs.md#native-route-inventory-and-parity).

Pages and layouts may also expose typed static metadata, generated metadata,
route-matched `generateStaticParams`, and compile-time-only literal segment
config. `MetadataProps` keeps layout inputs honest, while page-only
`PageMetadataProps` adds readonly query input. The segment marker disappears
before runtime output; its reviewed values become direct native Next exports.
The complete field table, rationale, generated adapter, and fail-closed examples
are in the
[metadata and segment-config reference](docs/metadata-and-segment-config.md).

## Haxe Route Handlers

An annotated `@:next.route("api/echo/[id]")` class exposes idiomatic
lower-camel Haxe methods with `@:next.GET`, `POST`, `PUT`, `PATCH`, `DELETE`,
`HEAD`, or `OPTIONS`. The macro requires a safe Web/Next request, a
Promise-shaped `RouteContext<Params>` whose fields exactly match the route, and
an explicit Web/Next response result. Duplicate or unsupported method exports,
structural context substitutes, wrong params, and incompatible results fail at
their Haxe source positions before an adapter is published.

The generated `route.ts` uses ordinary named uppercase exports and independently
checks each method against Next's route-literal `RouteContext`. It contains no
business logic, cast, or custom routing runtime. The complete positive and
negative authoring contract is in the
[Route Handler reference](docs/route-handlers.md).

## Haxe request proxy

One `@:next.proxy` class exposes a public static `proxy` function typed with
ergonomic `ProxyRequest`/`ProxyResponse` views (with raw Next types available),
optional `NextFetchEvent`, and an explicit Web/Next response.
Optional `@:next.matcher(...)` metadata keeps slash-prefixed matcher literals
beside the Haxe behavior, canonicalizes them deterministically, and emits a
`ProxyConfig`-typed native config object. Next's matcher parser and production
build remain the final grammar and runtime oracle.

The CLI publishes only the exact supported convention file: package-root
`proxy.ts` for `app/`, or `src/proxy.ts` for `src/app/`. It does not broaden
ownership to the package or `src` directory, and an existing native proxy is
left untouched with a stable collision diagnostic. The motivation, generated
adapter, positive and negative examples, accepted signatures, ownership model,
and focused/runtime evidence are in the [proxy reference](docs/proxy.md).

## Typed request and response codecs

`nextjs.codec.*` turns the deliberate `genes.ts.Unknown` request boundary into
closed application values. Exact JSON object decoders, scalar/optional/repeated
form and query readers, reusable text validators, exhaustive `DecodeResult<T>`,
stable issue codes and paths, and precise `ResponseJson` helpers provide Haxe
ergonomics while retaining native Web and Next runtime behavior.

This layer was added after the public server bindings and todo application made
two concrete gaps visible: upstream `Request.json()` is declared as
`Promise<any>`, while Haxe 4.3.7's legacy FormData projection exposes obsolete
file and iterator types. The semantic layer corrects both authoring boundaries
without modifying Next, adding a serializer, or turning internal domain values
into needless wire schemas.

```sh
npm run test:codecs
```

The focused gate proves successful JSON, form, and query decoding; eight
malformed input paths; signed 32-bit edges; exact response body inference;
JSON-compatible output enforcement; strict TypeScript with library checks; and
cast-free generated boundary code.
The rationale, positive Route Handler example, negative unchecked-input and
invalid-response controls, supported primitives, and limits are in the
[codec reference](docs/codecs.md).

## Server, client, and cache boundaries

[ADR 0003](docs/adr/0003-boundary-classification-and-import-graph-enforcement.md)
locks the graph model for the client-component, Server Function,
serializability, environment-containment, and cache work. One Haxe module has
one primary classification: server-default, client, Server Function,
shared-pure, explicit server-only, or explicit client-only. Cache is a
version-gated server execution boundary, not a separate transport runtime.

The Haxe layer must reject known raw implementation crossings early and provide
generated typed component/action refs for Next's two native cross-boundary
edges. It owns exact directive placement and targeted DCE retention. Strict
TypeScript and `next build` remain mandatory because only the final Next graph
includes native TypeScript, third-party packages, framework transforms, and
the complete transitive client bundle.

[ADR 0004](docs/adr/0004-haxe-native-react-component-authoring.md) locks the
Haxe-native authoring contract without changing that graph: reusable Server
Components remain ordinary Haxe functions, zero-argument client declarations
infer private adapters, and an explicit static extension provides
caller-sensitive `Component.client()` refs. Explicit adapter paths and
`ClientComponent.ref(ComponentType)` remain validated compatibility forms for
existing code and the uncommon case that requires a deliberate public path.

[ADR 0006](docs/adr/0006-haxe-native-react-hook-authoring.md) adds the matching
Hook authoring contract: exact raw tuples remain available, while the semantic
layer separates eager/lazy initialization and replacement/update intent,
packages explicit dependencies, and publishes Haxe Hooks as native-style typed
client exports for ordinary TSX consumers.

`@:next.serverOnly` and `@:next.clientOnly` emit ordinary binding-free Next
poisoning imports. `nextjs.env.ServerEnvironment` provides named
`Undefinable<String>`/required access without exposing the whole environment.
The focused gate proves early Haxe failures, deterministic marker output, a
blocking native Client Component violation, and absence of a server key and
sentinel value from the successful build's browser chunks:

```sh
npm run test:environment-boundaries
npm run test:clientification-boundaries
```

`nextjshx boundaries` reports Haxe-known owners, typed dependencies, props, and
generated refs, then joins exact Client Component adapters to final Next
client-reference chunks when compatible production evidence exists. Optional
budgets warn with a leaf-boundary/server-slot remediation without claiming that
Haxe sees native or third-party transitive edges. See
[component-boundary reports](docs/clientification-reports.md).

`@:next.clientComponent` validates a synchronous Haxe component and infers one
collision-safe private, directive-first native boundary adapter. With
`using nextjs.client.ClientComponent`, Server Haxe code renders its exact props
through `ComponentType.client()`, which imports only that generated adapter and
keeps the raw client implementation out of the server graph. A conservative
recursive validator accepts the exercised plain-value contract and reports
unsafe functions, class instances, unknown values, and cycles at their exact
prop path:

```sh
npm run test:client-components
```

That gate includes deterministic output, 28 exact negative controls, pinned
official React Hook/dependency/purity lint controls, strict TypeScript, a real Next
production build, and a hydrated browser click. Reviewed Hook identity follows
typed imports and aliases rather than `use*` spelling; semantic React `use`
requires `CachedPromise` and retains React's conditional/loop exception.
Semantic `useState` names replacement and update intent, `useStateLazy` safely
stores callable values, and direct `React.deps(...)` emits a closed inline
dependency list. Generic and non-generic Haxe Hooks publish as directive-first
typed const aliases that ordinary TSX consumes without a wrapper. See the
[Client Component reference](docs/client-components.md) and
[React Hook and interop reference](docs/react-hooks.md).

`@:next.serverFunctions(path)` validates one or more public static
`@:next.action` plus `@:async` methods and publishes a directive-first native
action module. Client code selects one exact export through
`ServerFunction.ref(TodoActions.save)`, preserving its Haxe function type while
keeping the raw server implementation out of the client graph. Arguments and
results use a conservative closed native-serialization contract; top-level
`WebFormData` inputs are decoded with a Server-Action-aware exact-field helper:

```sh
npm run test:server-functions
```

The gate includes deterministic Haxe and plan output, 13 exact negative
controls, a runtime ordering/short-circuit probe, strict generated TypeScript,
a real Next production build, and browser form POSTs covering authorized,
malformed, unauthenticated, cross-tenant, stale, overexposed-result, and
configured-body-limit behavior. Sensitive actions can use the typed
`GuardedAction` pipeline, but every callback remains application-owned. The
rationale, generated async wrapper, positive/negative examples, supported
values, `$ACTION_*` form handling, and security rules are in the
[Server Function reference](docs/server-functions.md).

The ADR includes the import matrix, positive generated-ref shape, negative raw
client/shared-request examples, one-module rule, DCE policy, cache/request API
limits, secret-containment rules, and phase-by-phase enforcement ownership. The
implemented metadata, named environment API, diagnostics, positive/negative
examples, and exact evidence are in the
[environment-boundary reference](docs/environment-boundaries.md).

## Haxe loading, error, and not-found files

`@:next.loading(path)`, `@:next.error(path)`, and `@:next.notFound(path)` map one
typed Haxe class to Next's exact `loading.tsx`, `error.tsx`, or `not-found.tsx`
filename. Loading and not-found renders are zero-argument Server Components.
Error renders require semantic `ErrorProps`, which preserves
`Error & { digest?: string }` and the zero-argument `reset` callback.

The macro automatically places `"use client"` first in `error.tsx`; authors do
not duplicate a TypeScript-only module directive or widen boundary props to a
structural escape type. Wrong props, async errors, extra public exports, and
non-element results fail during Haxe typing. The exact positive/negative
examples and production runtime evidence are in the
[special-file reference](docs/special-files.md).

## Typed ecosystem package integrations

Maintained npm integrations are explicit compatibility contracts rather than
incidental imports. The repository pins each package, lock integrity, license,
public module, declaration digest, required exports, Haxe/native sources, and
executable evidence. Raw externs stay faithful; semantic Haxe facades are added
only when they reduce code or prevent a real host-language footgun without
changing the package runtime.

```sh
npm run integrations:check
npm run test:integrations
npm run test:dnd-kit
```

The [package integration guide](docs/package-integrations.md) documents the
precise-or-omitted adoption and upgrade workflow. [ADR 0007](docs/adr/0007-reviewed-npm-package-integrations.md)
locks package/runtime ownership and the `nextjs.raw.integrations.*` versus
`nextjs.integrations.*` namespace split. The maintained
[nuqs integration](docs/nuqs.md) demonstrates typed nullable/defaulted URL
state, closed enum-abstract string domains that remain TypeScript literal
unions through values, callbacks, arrays, aliases, and generic applications,
intent-specific setters, App Router setup, browser-history behavior, and
bidirectional Haxe/TypeScript Hook interop. The maintained
[Radix/shadcn integration](docs/radix-shadcn.md) demonstrates direct native
component imports, separate plain and polymorphic Haxe identities, exact
single-element composition, and Dialog focus behavior. The maintained
[dnd-kit integration](docs/dnd-kit.md) demonstrates a closed drag-event slice,
typed element/handle refs, exhaustive reorder outcomes, direct package imports,
and real pointer, keyboard, and narrow-screen production behavior.

## Stable integration fixture

The required package lane invokes the real `nextjshx build` workflow from a
clean consumer package. It compiles typed Haxe 4.3.7 through the exact genes-ts
commit into split, extensionless ESM TS/TSX and transactionally publishes
manifest-owned root-layout, `/haxe` page, `/products/[slug]` page, Route Handler,
loading, error, and not-found adapters. It runs Next 16.2.12 type generation,
strict TypeScript 6.0.2, and the production build, then proves static and
generated metadata, two prerendered Haxe product slugs, a rejected ungenerated
slug, root-layout composition, GET/POST/DELETE, streamed loading, a hydrated
HTTP 404, and browser-driven error/reset recovery on the supported Node lanes.

```sh
npm run test:fixture:next-stable
npm run test:fixture:next-stable:smoke
```

The dependency contract pins React and React DOM 19.2.7. It also locks the
TypeScript compatibility wrapper's compiler core to 6.0.2 and overrides
PostCSS to 8.5.23; `npm run security:audit` rejects moderate-or-higher audit
findings, while the production fixture verifies those resolutions work with
the pinned Next release.

## Production todo application

[examples/todoapp-next](examples/todoapp-next) is the first maintained
application slice rather than another isolated compiler fixture. Its Haxe-owned
root layout, root list page, dynamic detail page, generated metadata, loading
UI, not-found view, generated typed href companions, Client Components, and
Server Functions compose with a typed Route Handler and reusable cached
function through the same CLI and fourteen manifest-owned Next adapters used by
consumers: one action module, five
Client Components, layout/list/detail pages, error/loading/not-found files, one
Route Handler, and one cached-function module.

The application reads a fixed-schema TSV repository on every server render and
atomically replaces an owner-only runtime file for create, toggle, and delete.
Clean builds fall back to tracked deterministic seed bytes; production smoke
and each Playwright test write a unique ignored owner-only run file, replace
the first record, and prove `next start` observes the new bytes without relying
on process-local state or an ORM. The Haxe domain and persistence sources contain no `Dynamic`,
`Any`, `untyped`, cast, JSON-domain assertion, or reflection shortcut.

```sh
npm run test:example:todoapp:source
npm run test:example:todoapp:build
npm run test:example:todoapp:smoke
npm run test:example:todoapp:e2e
# or the complete application gate:
npm run test:example:todoapp
```

The browser gate first requires exact header/cookie reads from the valid Route
Handler context and a typed HTTP 400 for malformed JSON without mutation. It
then primes the shared list cache, creates through typed JSON, and proves native
tag invalidation changes the next visible server render. The same lane rejects
invalid form input with typed issues, then proves Server Action `updateTag`
behavior, valid create, a newly created dynamic detail route, toggle, delete,
generated navigation, status-real Board grouping with lane-local sorting,
desktop/mobile pointer sorting, and keyboard sorting
before hydrating the Haxe not-found view. Because
the required `todos/loading.tsx` boundary commits a stream, pinned Next 16.2.12
uses its documented `200` plus `robots=noindex` behavior when `notFound()`
interrupts the render; the raw HTTP and browser checks lock both transport and
visible semantics. The example README contains the rationale, persistence
schema, positive and negative navigation, mutation, request-context, and cache
examples, plus the reason each integration change was needed. Its Playwright
suite adds visible loading and typed error-reset coverage, uses owner-only
state plus cache namespaces per test, fixes `workers: 1` and `retries: 0`, and
runs as a dedicated production E2E job in CI.

The [Field Ledger flagship case study](docs/todoapp-flagship.md) is the concise
cross-layer map: ownership, Haxe-versus-TypeScript examples, interop seams,
limitations, bundle cost, and the reproducible publication evidence matrix.

## Reusable test harness

The baseline harness provides positive Haxe compilation, exact expected-failure
diagnostics with source positions, deterministic adapter-plan evidence,
route-pattern and exact params validation, complete generated-tree snapshots,
and an offline packed-artifact consumer. It also compiles framework-neutral
genes-ts gap repros through TypeScript and classic JavaScript output:

```sh
npm run test:harness
npm run test:architecture
npm run test:adapter-plan
npm run test:routes
npm run test:page-layouts
npm run test:metadata-segment
npm run test:route-handlers
npm run test:special-files
npm run test:proxy
npm run test:route-hrefs
npm run test:environment-boundaries
npm run test:client-components
npm run test:server-functions
npm run test:config-discovery
npm run test:ownership-preflight
npm run test:publication
npm run test:cli
npm run test:dev
npm run test:next-surface
npm run test:next-bindings
npm run test:next-core-navigation
npm run test:next-components
npm run test:next-server
npm run test:codecs
npm run test:snapshots:update # only for an intentional, reviewed update
```

Fixture authoring and snapshot review rules are documented in
[docs/testing-strategy.md](docs/testing-strategy.md). The prioritized compiler
findings, current workarounds, and upstream ownership are recorded in the
[genes-ts compiler gap inventory](docs/compiler-gap-inventory.md).
The versioned plan contract and its validation boundary are documented in the
[adapter-plan reference](docs/adapter-plan.md).
The accepted App Router path grammar, exact params types, and codec boundary are
documented in the [route-pattern reference](docs/route-patterns.md).
The semantic props contracts, render validation, injected hrefs, exact plan
shape, and fail-closed examples are documented in the
[page/layout reference](docs/pages-and-layouts.md).
The typed metadata fields, exact static-param route matching, literal config
vocabulary, compile-time erasure, and Next-version gate are documented in the
[metadata and segment-config reference](docs/metadata-and-segment-config.md).
The Haxe method annotations, Promise-shaped context, response contract, named
exports, and fail-closed examples are documented in the
[Route Handler reference](docs/route-handlers.md).
The exact JSON/form/query boundary, exhaustive decode results, deterministic
issues, checked JSON responses, and malformed-input controls are documented in
the [codec reference](docs/codecs.md).
The automatic client directive, semantic error/reset props, server fallback
contracts, exact targets, and runtime recovery proof are documented in the
[special-file reference](docs/special-files.md).
The typed request function, compile-time matcher literals, exact root placement,
and native-collision behavior are documented in the
[proxy reference](docs/proxy.md).
The generated Haxe companion API, URL encoding rules, emitted type shape, and
Next typed-route parity boundary are documented in the
[route-href reference](docs/route-hrefs.md).
Closed outbound query schemas, cardinality, domain codecs, native
`URLSearchParams` behavior, and fail-closed examples are documented in the
[typed-query reference](docs/route-queries.md).
The explicit module markers, named server environment access, Haxe-visible
import diagnostics, client-bundle exclusion proof, and mandatory native Next
negative are documented in the
[environment-boundary reference](docs/environment-boundaries.md).
The directive-first adapter, precisely typed server ref, serializable-prop
allowlist, raw-import rejection, and hydration proof are documented in the
[Client Component reference](docs/client-components.md).
Allocation-free semantic state, explicit memo dependencies, callable-state
safety, raw tuple fidelity, and bidirectional native/Haxe Hook consumption are
documented in the [React Hook and interop reference](docs/react-hooks.md).
The directive-first native action adapter, actual async named exports, precise
action ref, serializable argument/result allowlist, form transport handling,
and per-action security boundary are documented in the
[Server Function reference](docs/server-functions.md).
The closed schema-v1 config, package/workspace detection, package-manager
evidence, and fail-closed App Router discovery rules are documented in the
[configuration reference](docs/configuration.md).
The reviewed Next.js entrypoints, normalized signatures, raw/semantic intent,
and non-public `next/dist/**` support boundary are documented in the
[public binding inventory](docs/binding-policy.md).
The practical choice between semantic authoring, faithful raw calls, native
TypeScript/JavaScript interop, and unsupported-surface handling is documented
in [Bindings, semantic APIs, and interop](docs/bindings-and-interop.md).
The schema-v1 output manifest, reserved-path policy, digest verification,
native collision behavior, and pure change classification are documented in
the [generated-output ownership reference](docs/generated-output-ownership.md).

## Command-line workflow

The internal CLI now coordinates Haxe compilation, fresh adapter-plan
collection, closed rendering, transactional publication, Next route type
generation, and strict TypeScript:

```sh
npm run nextjshx -- init
npm run nextjshx -- generate
npm run nextjshx -- clean
npm run nextjshx -- typecheck
npm run nextjshx -- routes --check
npm run nextjshx -- doctor
npm run nextjshx -- build -- --turbopack
npm run nextjshx -- dev -- -p 3000
```

All finite commands support deterministic human output and `--json`;
`dev` uses a prefixed long-running event stream. `generate`
reports created, updated, unchanged, and removed paths and rolls back the exact
prior tree if Next or TypeScript rejects the published adapters. Ownership
failures report the specific blocked native or modified target. `typecheck`
and `routes --check` refuse to claim parity against stale generated files.
`build` runs doctor, clean Haxe generation, publication, both type gates, the
native Next production build, and a fresh plan/manifest verification in that
order; reviewed ordinary Next build flags pass through after `--`.
`dev` performs an initial safe generation, watches nested HXML/classpaths,
resources, scoped libraries, config and declared extra inputs, serializes
changes received during compilation, and keeps one native Next dev process in
charge of HMR and Fast Refresh. A failed edit retains the exact verified
last-good tree; a later valid edit recovers without restarting Next. The owned
Haxe server uses the real `.haxerc`-pinned compiler rather than Lix's Node shim,
falls back to direct compilation when unavailable, and is cleaned up with only
the processes created by that invocation. Native watch events are reconciled
every 250 ms so a platform-coalesced edit cannot disappear. After Haxe
succeeds, each generated Next adapter carries a deterministic digest of only
the reachable generated implementation modules behind that entry. A changed
body or shared dependency therefore changes the affected manifest-owned
adapter's bytes and gives Next a canonical content invalidation; unrelated
adapters remain byte-identical.

For the reviewed Next 16.2.12 pin on macOS, a bare dev command uses Next's
supported Webpack backend because a reduced handwritten `app/page.tsx` control
proved the default Turbopack watcher could stop invalidating files. Explicit
bundler flags remain untouched, and other platforms retain Next's default.

For an application without a separate stylesheet compiler, use
`"dev": "nextjshx dev --"` in `package.json`. The retained separator makes
`npm run dev -- -p 3100` forward appended flags directly into
Next's reviewed argument namespace.

Each maintained site exposes one ergonomic styled development command. It
rebuilds the internal CLI, performs the initial Tailwind compile, starts the
Tailwind watcher, and then delegates application watching to `nextjshx dev`:

```sh
npm run dev --workspace @nextjshx/showcase-landing
npm run dev --workspace @nextjshx/showcase-blog -- --webpack -p 3100
npm run dev --workspace @nextjshx/showcase-commerce
npm run dev --workspace @nextjshx/mixed-adoption
npm run dev --workspace nextjshx-todoapp-example
```

See the [CLI reference](docs/cli.md) for command contracts, positive and
negative examples, stable diagnostics, and recovery behavior.

## Architecture constraints

[Architecture](docs/architecture.md) and its accepted ADRs are normative for
implementation decisions.

- Next.js remains the runtime, router, compiler, bundler, and deployment model.
- `nextjs.raw.*` models supported public Next.js APIs faithfully.
- `nextjs.*` adds typed Haxe ergonomics and smooths verified Next.js
  shortcomings without hiding or replacing native semantics.
- Generated convention adapters are short, deterministic, and manifest-owned.
- Native TypeScript/JavaScript routes are never overwritten implicitly.
- Generated publication formats and parses the complete staged tree, replaces
  the ownership manifest last, rolls back failed strict validation, and refuses
  crash recovery when live bytes match neither journaled state.
- Generic compiler gaps are reduced and fixed in `genes-ts`; Next-specific
  behavior stays in NextJsHx.
- Repository-owned Haxe and generated public APIs do not use unreviewed
  `Dynamic`, `Any`, `untyped`, broad `unknown`, or unchecked casts.

The detailed product contract is in
[nextjshx-prd.md](nextjshx-prd.md). Live execution state is in Beads; the seed
JSON and Markdown are reproducible bootstrap artifacts, not a second tracker.

The host-native tooling contracts can be checked independently:

```sh
npm run test:config-discovery
npm run test:ownership-preflight
npm run test:publication
npm run test:cli
npm run test:dev
```

See [configuration](docs/configuration.md),
[generated-output ownership](docs/generated-output-ownership.md), and
[transactional publication and recovery](docs/generated-output-publication.md),
plus the [CLI workflow](docs/cli.md), for the closed schemas, stable
diagnostics, atomic ordering, and safe recovery decisions.

## Public-repository safety

Install the tracked hooks before contributing:

```sh
npm run hooks:install
```

Pre-commit formats staged repository-owned Haxe, rejects whitespace and
machine-local path leaks, scans staged content for secrets, and runs only fast
contracts affected by the staged paths. Pre-push scans all reachable Git and
Beads history and runs the medium compiler/package gate. Before changing
visibility or publishing a ref, run:

```sh
npm run beads:install-pinned
npm run public:preflight
```

Beads data uses a separate Dolt ref. Publish it only through:

```sh
npm run beads:push
```

The installer produces a checksum-verified repository-local Beads binary from
upstream merge commit `7eb428cde13c6d2c4743a76533be8df2d418aff5`, containing
PR #4912's migrated NULL-history fix; it does not replace the user's global
`bd`. The push wrapper uses that exact binary to scan decoded current and
historical issue records before invoking `bd dolt push`. Replace the temporary
commit pin with the first stable Beads release containing the fix. Do not put
secrets or private vulnerability details in GitHub issues, pull requests, CI
logs, generated files, or Beads.

## License

NextJsHx is free software licensed under the
[GNU General Public License version 3](LICENSE).
