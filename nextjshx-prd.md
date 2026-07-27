# NextJsHx Product Requirements Document

- **Repository/package working name:** `nextjshx`
- **Product name:** NextJsHx
- **Document status:** Implementation-ready draft
- **Date:** 2026-07-16
- **Primary implementer:** Codex, working through Beads
- **Primary upstream framework:** Next.js
- **Primary compiler:** genes-ts
- **Initial framework scope:** Next.js App Router
- **Upstream checkout assumption:** read-only sibling at `../nextjs`

> This PRD is the implementation contract until a reviewed ADR or Bead changes it. Beads is the execution source of truth once the seed backlog has been imported. This document describes product and architecture; it is not a second task tracker.

---

## 1. Executive summary

NextJsHx is a **Next.js-first Haxe framework layer**. It lets developers author Next.js applications and reusable Next.js modules in typed Haxe, compile them to strict TypeScript/TSX through genes-ts, and run them with the ordinary Next.js runtime, router, compiler, bundler, and deployment model.

NextJsHx does **not** fork Next.js, reimplement React Server Components, invent a second router, or hide Next.js behind a foreign runtime. Its job is to make Next.js’s public TypeScript surface and App Router conventions pleasant and safe from Haxe while preserving recognizable, reviewable, Next-native generated output.

The product has three coordinated layers:

1. **Faithful bindings** to supported public `next/*` package entrypoints. These are the 1:1 escape hatch and compatibility surface.
2. **Haxe-native ergonomic APIs and compile-time DSLs** for routes, pages, layouts, route handlers, client boundaries, Server Functions, navigation, metadata, cache policy, request APIs, and common components.
3. **Next-native tooling and generated adapters** that materialize exact `app/**/page.tsx`, `layout.tsx`, `route.ts`, action, client-boundary, and other convention files. The adapters add directives and export shapes that a file-per-Haxe-module compiler cannot naturally express, while delegating behavior to genes-ts output.

The first production target is a typed App Router application on the pinned stable Next.js line. Pages Router support is interoperability scope, not an initial parity commitment.

The reference model is the same one established by PhoenixHx and RailsHx:

- the host framework remains the runtime and semantic oracle;
- raw framework façades remain available;
- compile-time Haxe helpers lower to native framework artifacts;
- generated output is owned, staged, hashed, and fail-closed;
- mixed Haxe and native framework code is a first-class adoption mode;
- real framework applications and browser tests are required evidence;
- missing compiler capabilities are fixed generically in genes-ts rather than special-cased for one downstream project.

A lower-priority addendum proposes **ContractHx**, a transport-neutral, Haxe-authored contract layer that can generate a typed NextJsHx client plus PhoenixHx or RailsHx server adapters. It is intentionally “tRPC-like” only in the narrow sense that one shared declaration can generate both ends. It is not a new full-stack runtime and must not replace ordinary Next, Phoenix, or Rails behavior.

---

## 2. Research and baseline

### 2.1 Reference projects reviewed

This PRD is based on the supplied snapshots of:

- genes-ts;
- PhoenixHx / Reflaxe.Elixir;
- RailsHx / Reflaxe.Ruby;
- their architecture, agent instructions, testing strategies, generated-output ownership rules, gradual-adoption patterns, and typed cross-boundary protocol work.

The most important inherited design patterns are:

- **Framework-first output.** Generated artifacts should look like idiomatic host-framework code.
- **Faithful surface plus better surface.** Keep a recognizable raw API, then add Haxe-native semantic wrappers when they improve safety or readability.
- **Typed DSL rule.** Type-check in Haxe, erase compile-time scaffolding where possible, and emit native host artifacts rather than a parallel runtime DSL.
- **Narrow unsafe boundary.** Avoid `Dynamic`, `untyped`, generated `any`, or broad `unknown` in app-facing APIs. Decode external data at explicit boundaries.
- **Fail-closed ownership.** Never infer ownership from a directory scan. Verify paths and hashes, reject collisions, stage the entire next tree, and publish atomically.
- **Gradual adoption.** Existing native code may stay native and be consumed through checked externs or façades; generated files must never overwrite native-owned files implicitly.
- **Evidence pyramid.** Generated-output snapshots and negative compile tests first, then focused runtime seams, then a real framework application and browser tests.
- **Compiler independence.** A downstream-discovered genes-ts issue must be reduced to a generic JS/TS/Haxe construct and proven in the full genes-ts CI matrix.

### 2.2 Verified upstream baseline at PRD time

The initial implementation should pin a machine-readable compatibility baseline rather than using floating `latest` versions.

| Surface | Initial contract |
|---|---|
| Next.js | Stable `16.2.x`, initially exercised at `16.2.12` |
| Next.js upstream source | Exact tag/commit recorded from `../nextjs`; read-only |
| App model | App Router first |
| Node.js | Next.js floor `>=20.9.0`; CI tests the floor and one pinned current LTS |
| React | React 19 primary fixture |
| Haxe | Exactly `4.3.7` for the initial contract |
| genes-ts | Supplied `1.27.0`-era contract, pinned by exact package version or sibling commit |
| TypeScript | Workspace-pinned version accepted by the selected Next.js release |
| Browser E2E | Playwright, pinned in the fixture lockfile |
| Bundler | Turbopack/default Next build lane; Webpack compatibility lane after the core vertical slice |

The repository must store this in `support_matrix.json`. Human-readable compatibility documentation is derived from that file. A version is supported only when its declared evidence lane is green.

### 2.3 Relevant Next.js constraints

Next.js is a convention-driven TypeScript/React framework. Its App Router expects exact file paths, exact default or named exports, and several top-of-file or function directives. Important examples include:

- `app/**/page.tsx` and `layout.tsx` default exports;
- named HTTP method exports from `route.ts`;
- `proxy.ts` at the app/project boundary;
- `"use client"` boundaries;
- `"use server"` Server Function modules;
- `"use cache"` and related cache directives;
- route-aware generated TypeScript helpers such as `PageProps`, `LayoutProps`, and `RouteContext`;
- async `params`, `searchParams`, `cookies()`, and `headers()` on the supported line.

Genes-ts emits split ESM TypeScript/TSX **file-per-Haxe-module**. It can import npm packages and emit React TSX, but a Haxe class does not naturally become an arbitrarily named `page.tsx` with a default function export and a directive before all imports. This is the central integration seam.

The stable solution is a generated adapter layer. Generic compiler improvements such as module directives and export metadata are still desirable, but NextJsHx must not depend on a large, Next-specific compiler fork.

---

## 3. Problem statement

A Haxe developer can already compile typed code and React TSX through genes-ts, but a production Next.js application requires more than rendering React elements:

- route modules are discovered from filesystem conventions;
- server and client module graphs have different capabilities;
- Server Functions and cache boundaries rely on directives;
- route params and route helpers are generated from the application tree;
- components such as `Link`, `Image`, and `Form` have rich TypeScript contracts;
- `next/navigation`, `next/headers`, `next/cache`, and `next/server` expose framework-specific behavior;
- special files have different required signatures and export names;
- Next.js types evolve quickly, and many public declarations re-export internal declaration files;
- a mixed application may contain Haxe-owned routes beside hand-authored TypeScript routes.

A naïve extern-only package would expose functions but would not solve authoring, routing, directives, export shapes, or safe generation. A naïve code generator could create files but would lose Next.js type checking or overwrite application source. A custom runtime would duplicate framework behavior and drift.

NextJsHx must bridge these constraints without lowering the quality bar established by PhoenixHx, RailsHx, and genes-ts.

---

## 4. Product principles

### 4.1 Next.js is the semantic oracle

When Haxe ergonomics and Next.js behavior conflict, Next.js behavior wins. Abstractions may improve authoring but may not silently change caching, rendering, routing, serialization, error, or deployment semantics.

### 4.2 App Router concepts remain visible

NextJsHx should make pages, layouts, route handlers, client components, Server Functions, cache policy, metadata, and route segments safer—not rename them into unrelated concepts. A Next.js developer should recognize the generated application.

### 4.3 One faithful layer, one semantic layer

Every supported area should expose:

- a faithful `nextjs.raw.*` surface shaped like the public TypeScript API; and
- an optional semantic `nextjs.*` façade where Haxe types, macros, generated refs, or better diagnostics add real value.

The semantic layer must not make the raw layer inaccessible.

### 4.4 Compile-time helpers should disappear

Route declarations, metadata validators, segment configuration builders, client-boundary checks, action signatures, and generated refs should lower to ordinary TypeScript, TSX, directives, exports, and Next.js calls. Do not ship a broad browser or server runtime merely to preserve an authoring DSL.

### 4.5 Generated output is native and reviewable

Adapters should be short, deterministic, formatted, and unsurprising. A typical route adapter should be understandable without knowing Haxe compiler internals.

### 4.6 Unsafe values stop at explicit boundaries

Application and test code should not use `Dynamic` or `untyped`. External JSON, request bodies, environment data, and third-party values enter through a typed decoder or a narrowly documented `genes.ts.Unknown` boundary and are immediately narrowed.

### 4.7 Server/client boundaries are first-class types

The library must distinguish server-only, client-only, shared, and boundary-serializable values. It must catch obvious violations in Haxe and still let Next.js’s TypeScript plugin and build remain the final verifier.

### 4.8 Mixed ownership is normal

A project may contain:

- Haxe-owned route modules;
- TypeScript-owned route modules;
- TypeScript components consumed by Haxe;
- Haxe components consumed by TypeScript;
- a native `next.config.*` file;
- native third-party Next packages.

The toolchain must support this without claiming ownership of the entire application.

### 4.9 Compiler fixes remain generic

NextJsHx may identify missing genes-ts capabilities, but genes-ts must not gain concepts such as “page route” or “Server Action.” It may gain generic concepts such as module directives, named/default exports, side-effect imports, import types, or precise TS helper types—with paired TS and classic-JS evidence.

### 4.10 Claims require evidence

A supported feature needs:

- a positive Haxe fixture;
- a generated TS/TSX snapshot;
- strict TypeScript checking;
- a negative compile test where misuse is plausible;
- a Next.js build or runtime seam test where framework consumption matters;
- user documentation.

---

## 5. Goals

### G1. Consume supported public Next.js APIs from Haxe

Provide maintained typed bindings for a curated allowlist of public package entrypoints, including components, navigation, request APIs, cache APIs, server request/response types, and core config/types.

### G2. Author App Router modules in typed Haxe

Support Haxe-owned pages, layouts, loading states, error boundaries, not-found states, route handlers, metadata, static params, client components, and Server Function modules through generated Next-native adapters.

### G3. Improve ergonomics without obscuring Next.js

Add compile-time checked route refs, param contracts, segment config, navigation helpers, common component props, server/client diagnostics, and action/handler contracts.

### G4. Preserve strict generated TypeScript

Generated TypeScript and TSX must type-check under a strict project configuration. NextJsHx must not normalize success around `any`, blanket casts, `skipLibCheck` workarounds, or disabled Next build errors.

### G5. Support gradual adoption in both directions

Haxe must consume native TypeScript/Next modules through typed imports. Native TypeScript must be able to import stable Haxe-generated modules and adapters. NextJsHx must refuse to overwrite native-owned routes.

### G6. Provide a credible development loop

A developer should be able to initialize, generate, watch, type-check, run `next dev`, build, inspect routes, diagnose configuration, and clean generated adapters with ordinary package scripts.

### G7. Prove the product in a real application

Ship a maintained App Router todo application that exercises server rendering, client interactivity, Server Functions, route handlers, navigation, request APIs, caching/revalidation, metadata, errors, mixed TS/Haxe interop, and browser behavior.

### G8. Track upstream compatibility deliberately

Use the published stable Next package as the release contract and `../nextjs` as a read-only source/type oracle and optional canary lane. Detect public-surface drift before silently emitting weak bindings.

### G9. Make Codex execution durable through Beads

Every implementation slice, discovered gap, decision, and compatibility issue must be represented in Beads with dependencies and acceptance criteria. No Markdown TODO list becomes a competing tracker.

---

## 6. Non-goals

The following are explicitly out of scope for the initial product:

- Forking, vendoring, or recompiling the Next.js runtime.
- Reimplementing React Server Components, Flight, Turbopack, SWC, routing, image optimization, or deployment adapters.
- Translating the Next.js source repository to Haxe.
- Binding every declaration under `next/dist/**` as a supported public API.
- Making Next.js look like Phoenix or Rails.
- Supporting every App Router special file in the first milestone.
- Full Pages Router authoring parity in `v0.1`.
- A custom state-management, data-fetching, ORM, authentication, validation, or styling framework.
- Automatic security or authorization for Server Functions and route handlers.
- Hiding deployment differences among Vercel, Node, containers, and adapters.
- Edge runtime support before the Node runtime lane is complete.
- Cross-framework RPC as a blocker for core NextJsHx.
- A generic TypeScript-to-Haxe source translator. Declaration ingestion may use `dts2hx`; reverse source translation remains bounded and experimental.

---

## 7. Users and primary use cases

### 7.1 Haxe-first Next.js application developer

Wants to write domain logic, React components, pages, handlers, and actions in Haxe while retaining Next.js’s router, rendering model, and ecosystem.

### 7.2 Existing Next.js team adopting Haxe selectively

Wants to keep most `app/**` files in TypeScript while introducing Haxe for a component family, domain module, route handler, or typed shared contract.

### 7.3 Haxe library author targeting Next.js

Wants to publish typed helpers/components that compile to normal TS/TSX and can be consumed by native Next.js projects.

### 7.4 Compiler/framework maintainer

Needs deterministic fixtures that reveal whether a break belongs in NextJsHx bindings/tooling or in generic genes-ts code generation.

### 7.5 Full-stack Haxe team using PhoenixHx or RailsHx

Eventually wants a shared domain and protocol package that can produce a typed Next frontend client and native Phoenix or Rails backend adapters without replacing those frameworks.

---

## 8. Product and repository shape

### 8.1 Recommended repository layout

```text
nextjshx/
├── AGENTS.md
├── README.md
├── haxelib.json
├── package.json
├── pnpm-workspace.yaml
├── support_matrix.json
├── build.hxml
├── src/
│   └── nextjs/
│       ├── raw/                 # faithful public Next externs
│       ├── app/                 # App Router contracts
│       ├── route/               # route refs and path codecs
│       ├── client/              # client-boundary APIs
│       ├── server/              # server-only APIs and actions
│       ├── cache/               # cache/revalidation helpers
│       ├── components/          # Link/Image/Form/Script façades
│       ├── codec/               # narrow boundary codecs
│       └── macro/               # build macros and registries
├── tools/
│   └── cli/                     # native Node/TypeScript CLI
├── config/
│   ├── next-public-entrypoints.json
│   ├── next-binding-overrides.json
│   └── diagnostics.json
├── scripts/
│   ├── sync-next-surface.*
│   ├── verify-upstream-next.*
│   └── release/*
├── tests/
│   ├── haxe/
│   ├── snapshots/
│   ├── negative/
│   ├── ownership/
│   ├── package-shape/
│   └── upstream/
├── examples/
│   ├── hello-next/
│   ├── mixed-adoption/
│   └── todoapp-next/
├── docs/
│   ├── architecture.md
│   ├── app-router.md
│   ├── server-client-boundaries.md
│   ├── generated-output-ownership.md
│   ├── gradual-adoption.md
│   ├── binding-policy.md
│   ├── testing-strategy.md
│   ├── compatibility.md
│   └── escape-hatches.md
└── .beads/
```

The root remains a normal Haxelib package. `tools/cli` is an npm workspace because initialization, package-manager integration, watch orchestration, and Next project discovery are Node ecosystem seams.

### 8.2 Shipped artifacts

The eventual release may contain two coordinated artifacts:

1. **Haxelib package `nextjshx`**
   - externs;
   - macro APIs;
   - semantic wrappers;
   - Haxe documentation and examples.

2. **npm tooling package** (working name `@nextjshx/cli`; availability must be verified before locking)
   - `nextjshx init`;
   - `nextjshx generate`;
   - `nextjshx dev`;
   - `nextjshx build`;
   - `nextjshx typecheck`;
   - `nextjshx routes`;
   - `nextjshx doctor`;
   - `nextjshx clean`;
   - maintainer-only surface sync commands.

The CLI may later be substantially Haxe-authored and compiled through genes-ts, but the first implementation may use hand-written TypeScript where it is the clearest host-native integration seam. Reusable route models, manifests, and validators should remain shareable rather than becoming ad hoc CLI-only logic.

### 8.3 Namespace policy

- `nextjs.raw.*` — faithful public Next.js façades.
- `nextjs.*` — supported semantic APIs.
- `nextjs._internal.*` — declaration support needed to type public entrypoints; `@:noCompletion`, undocumented, and not a compatibility promise.
- `nextjshx.*` should be reserved for tooling/build internals only if a separate namespace is necessary.

Application examples use app-owned packages such as `app.routes`, `app.components`, and `app.domain`; they do not place product code under `nextjs.*`.

---

## 9. Architectural overview

### 9.1 Build pipeline

```text
Haxe source
  │
  ├─ Haxe type checking + NextJsHx build macros
  │     ├─ validate route/module contracts
  │     ├─ register adapter intents
  │     ├─ validate server/client usage
  │     └─ emit deterministic generation plan
  │
  ├─ genes-ts
  │     └─ strict split ESM TypeScript / TSX under src-gen/
  │
  ├─ NextJsHx adapter publisher
  │     ├─ resolve exact app paths and relative imports
  │     ├─ render directives and default/named exports
  │     ├─ stage and format complete next output
  │     ├─ preflight manifest ownership and collisions
  │     └─ atomically publish app/** adapters
  │
  ├─ next typegen
  │     └─ Next-owned route-aware TypeScript helpers under .next/types
  │
  ├─ tsc --noEmit / Next TypeScript plugin
  │
  └─ next dev / next build / next start
```

### 9.2 Source-of-truth boundaries

- Haxe-owned behavior lives in `.hx` files.
- Genes-ts output under `src-gen/**` is generated source.
- Haxe-owned Next convention adapters under `app/**` or `src/app/**` are generated and manifest-owned.
- Native TypeScript files without a manifest entry are application-owned.
- `.next/**` and `next-env.d.ts` are Next-owned and never written by NextJsHx.
- `next.config.*`, package manifests, and tsconfig files remain application-owned unless an explicit `init` patch is reviewed and recorded.

### 9.3 Why generated adapters are the first stable bridge

Adapters solve four independent constraints cleanly:

1. **Exact path:** Next discovers `page.tsx`, `layout.tsx`, `route.ts`, and other filenames.
2. **Exact exports:** Next expects default component exports or named exports such as `GET`, `POST`, `generateMetadata`, and `config`.
3. **Directive placement:** directives must occur before imports or at the start of a function body.
4. **Type oracle:** adapters can use Next-generated global helpers and public TypeScript types, making Next’s own checker validate the Haxe-facing contract.

A typical generated adapter should contain no business logic:

```tsx
// Generated by NextJsHx. Source: app.routes.TodoPage. Do not edit.
import { TodoPage } from "../../../src-gen/app/routes/TodoPage";

export const revalidate = 60;

export default function Page(props: PageProps<"/todos/[id]">) {
  return TodoPage.render(props);
}
```

A client boundary adapter may be:

```tsx
"use client";

// Generated by NextJsHx. Source: app.components.TodoToggle. Do not edit.
import { TodoToggle } from "../../src-gen/app/components/TodoToggle";

export default TodoToggle.render;
```

A Server Function adapter may be:

```ts
"use server";

// Generated by NextJsHx. Source: app.actions.TodoActions. Do not edit.
import { TodoActions } from "../../src-gen/app/actions/TodoActions";

export async function createTodo(formData: FormData) {
  return TodoActions.createTodo(formData);
}
```

The generator must prefer wrappers with explicit public signatures over broad casts or untyped re-exports.

### 9.4 Compiler improvements versus framework adapters

The following generic genes-ts improvements are desirable and may be early blockers:

- deterministic module directive prologues;
- function-body directives;
- top-level named/default export metadata;
- robust side-effect imports;
- import-type support where runtime imports are undesirable;
- precise `never`, `undefined`, readonly, and union helpers;
- stable TSX component import handles.

These must be implemented generically, tested in TypeScript and classic-JS modes, and pass full genes-ts CI. NextJsHx adapters remain valid even after these improvements; direct emission should replace an adapter only when it produces an equally clear and verifiable Next-native contract.

### 9.5 Upstream Next.js checkout

`../nextjs` is a **read-only oracle**, not a vendored dependency and not the production runtime contract.

NextJsHx tooling should accept:

```text
NEXTJSHX_NEXT_UPSTREAM_DIR=../nextjs
```

The default may be recorded in local config, but library/runtime code must never hardcode a sibling path.

The upstream lane may:

- read `packages/next/package.json`;
- inspect public declaration entrypoints and their re-export graph;
- compare supported signatures;
- run selected fixture builds against a locally built Next package when available;
- record the exact tag/commit used for a compatibility report.

It must not:

- modify the checkout;
- depend on undocumented source modules in released app code;
- declare support solely because source inspection passes;
- make a canary checkout the stable release contract.

The published npm package at the pinned stable version remains the primary acceptance lane.

---

## 10. Public binding strategy

### 10.1 Public-entrypoint allowlist

Do not generate a public Haxe API for every `.d.ts` file shipped inside the package. Maintain an explicit allowlist in `config/next-public-entrypoints.json`.

Initial P0/P1 candidates:

| Module | Priority | Notes |
|---|---:|---|
| `next` / `next/types` | P0 | Core types and `NextConfig` subset |
| `next/link` | P0 | Default React component plus props |
| `next/image` | P0 | Default component plus image props |
| `next/form` | P0 | App Router form integration |
| `next/navigation` | P0 | Hooks, redirects, not-found/error interrupts |
| `next/headers` | P0 | Async cookies, headers, draft mode |
| `next/cache` | P0 | Revalidation, tags, cache lifetime, unstable legacy functions |
| `next/server` | P0 | `NextRequest`, `NextResponse`, proxy/middleware types, `after`, `connection` |
| Web `Request` / `Response` contracts | P0 | Route Handler boundary |
| `next/dynamic` | P1 | Lazy component loading |
| `next/script` | P1 | Script component |
| `next/font/*` | P1 | Font loader functions and generated classes |
| `next/og` | P2 | Image generation |
| `next/web-vitals` | P2 | Reporting hooks |
| `next/compat/router` | P2 | Migration aid only |
| `next/router` | P3 | Pages Router compatibility, not App Router core |
| experimental entrypoints | P3 | Opt-in, version-pinned, explicitly unstable |

The allowlist entry records:

- module specifier;
- supported exports;
- export kind;
- upstream signature hash;
- Haxe type path;
- raw/semantic status;
- stability classification;
- fixture that proves it.

### 10.2 Declaration ingestion

Use `dts2hx` or a focused declaration parser to bootstrap and update declarations, but do not commit opaque generated output without curation.

The sync workflow must:

1. Resolve the exact installed Next package version.
2. Read only allowlisted public entrypoints and the declaration files needed to type them.
3. Produce an intermediate normalized surface manifest.
4. Apply reviewed overrides for unsupported TypeScript constructs.
5. Generate or update Haxe externs deterministically.
6. Emit a human-readable drift report.
7. Run Haxe type fixtures, TS snapshots, and strict TypeScript checks.
8. Refuse to mark drift as accepted until a Bead and review explain it.

### 10.3 Public versus internal declaration types

A public entrypoint may re-export a type declared under `next/dist/**`. It is acceptable for the generated extern implementation to model that supporting type under `nextjs._internal.*`, but:

- app-facing docs must point to the public Haxe façade;
- no semantic wrapper imports an undocumented runtime module;
- `_internal` names carry no semver promise;
- an upstream refactor that preserves the public signature should not force user code changes.

### 10.4 Binding quality rules

- Preserve optional versus nullable versus undefined distinctions.
- Use enum abstracts/literal-union abstractions for closed string sets.
- Preserve generic parameters where Haxe can express them.
- Model overloads with typed extern overloads or focused semantic methods—not `Dynamic`.
- Use `genes.ts.Undefinable<T>` where JavaScript `undefined` is the contract.
- Use `genes.ts.Unknown` only at a real external boundary, followed by a decoder or type guard.
- Components receive typed props and produce the canonical genes React element type.
- Default imports, named imports, and namespace imports must emit the correct ESM shape in both genes output modes where applicable.
- Public docs state any intentional narrowing from the full TypeScript surface.

### 10.5 Drift policy

Public-surface drift is classified as:

- **compatible:** declaration moved internally but normalized public shape is equivalent;
- **additive:** new export or optional field;
- **behavioral review required:** changed docs/defaults without an incompatible type signature;
- **breaking:** removed export, changed required field, changed return/parameter shape;
- **unsupported TS construct:** parser/generator cannot faithfully represent it.

Breaking or unsupported drift opens a P0/P1 Bead and fails the sync lane. Additive drift creates a reviewed update Bead; it does not silently expand the supported surface.

---

## 11. App Router authoring model

### 11.1 Scope levels

#### P0 core special files

- root and nested `layout.tsx`;
- `page.tsx`;
- `loading.tsx`;
- `error.tsx`;
- `not-found.tsx`;
- `route.ts` with common HTTP methods;
- colocated or dedicated Server Function modules;
- static metadata and `generateMetadata`;
- `generateStaticParams`;
- segment config needed by the reference app.

#### P1 breadth

- `template.tsx`;
- `default.tsx` (implemented for typed parallel-slot fallbacks);
- `forbidden.tsx` and `unauthorized.tsx` where supported;
- `proxy.ts` (implemented at the root convention);
- `instrumentation.ts` and client instrumentation;
- metadata route files such as sitemap, robots, manifest, and generated images;
- route groups in the typed route model (implemented);
- robust mixed TS/Haxe route discovery.

#### P2/P3 breadth

- parallel routes and typed layout slots (implemented);
- intercepting routes with canonical hard-navigation ownership (implemented);
- advanced metadata image generation;
- Edge runtime qualification;
- Pages Router authoring and legacy data functions;
- experimental Next features behind explicit version gates.

### 11.2 Provisional page contract

The exact syntax must be locked by an ADR in the foundation milestone, but the implementation should target this semantic shape:

```haxe
package app.routes;

import genes.js.Async.await;
import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.SearchParams;

// The segment path is relative to the App Router root. Route groups may be
// included when supported; the public URL pattern is derived from it.
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

    return TodoView.render(todo);
  }
}

typedef TodoPageParams = {
  final id:String;
}
```

The build macro validates that `TodoPageParams` matches the route pattern. The generated adapter uses Next’s own route-aware `PageProps<"/todos/[id]">` helper, making TypeScript a second oracle.

### 11.3 Dynamic parameter rules

The initial validator should support:

| Segment | Required Haxe shape |
|---|---|
| `[id]` | `id:String` or a validated string-backed domain abstract |
| `[...slug]` | `slug:Array<String>` |
| `[[...slug]]` | `slug:Undefinable<Array<String>>` |
| static segment | no param field |

Rules:

- all dynamic segments must be represented;
- extra required fields are rejected;
- domain abstracts must have an explicit route codec or be safely string-backed;
- duplicate dynamic parameter names are rejected;
- malformed, reserved, or traversal-like segment paths fail before file generation;
- route groups and slots are stripped from the public URL but retained in the filesystem path;
- all four interception markers resolve by URL-segment depth and retain their
  filesystem spelling only in adapter ownership;
- intercepted views require an ordinary canonical page for hard navigation;
- named layout slots are required immutable `ReactNode` fields and require one
  Haxe-owned or native `default` convention each.

### 11.4 Route references and URL generation

Each Haxe-owned route class should expose generated, typed route metadata without a central two-pass registry requirement:

```haxe
final href = TodoPage.href({ id: todo.id });
Navigation.redirect(href);
```

The build macro may inject an inline or macro-backed `route`/`href` companion. It must:

- encode every dynamic segment;
- reject missing or extra params at Haxe compile time;
- support typed query construction through an explicit query codec;
- avoid importing server-only page implementation code into a client bundle merely to build a URL;
- emit no runtime class dependency when an inline/macro expansion can produce the string safely.

A generated aggregate `AppRoutes` façade is P1 for discoverability and TS-owned route interop. It must be derived from the route manifest, not become a second manually maintained route list.

### 11.5 Search parameters

Next’s raw page `searchParams` shape is a promise of a plain object whose values are `string`, `string[]`, or `undefined`.

P0 exposes:

- a faithful raw `SearchParams` type;
- safe helpers to get one, many, or optional values;
- an explicit decoder interface.

P1 supports a route-level typed query codec:

```haxe
typedef TodoQuery = {
  final page:Int;
  final filter:Undefinable<TodoFilter>;
}

@:next.searchParams(TodoQueryCodec)
@:next.page("todos")
class TodosPage { /* ... */ }
```

Decoding errors must have a documented policy selected by the route: default value, typed validation result rendered by the page, `notFound`, or explicit error. The library must not silently coerce malformed values.

### 11.6 Layouts

A layout contract includes:

- `children` as a React node;
- async params for dynamic ancestor segments;
- typed named slots only after parallel-route support exists;
- static or generated metadata;
- segment config.

The root-layout validator must ensure that the generated component contract can render `<html>` and `<body>`. This should be checked by the real fixture and generated TS snapshot rather than by brittle string inspection alone.

### 11.7 Loading, error, and not-found modules

- `loading` is a normal server component by default.
- `error` adapters automatically create the required client boundary and type `error`/`reset` props faithfully.
- `not-found` remains a server component unless Next changes the contract.
- error-reset callback types must not be widened to `Dynamic`.
- generated adapters use the exact special filename and default export required by the selected Next version.

### 11.8 Metadata and static params

Support both static metadata and function-based metadata without inventing a metadata runtime.

A page/layout may expose supported named methods or fields:

```haxe
public static final metadata:Metadata = {
  title: "Todos"
};

@:async
public static function generateMetadata(
  props:MetadataProps<TodoPageParams>,
  parent:ResolvingMetadata
):Promise<Metadata> { /* ... */ }

@:async
public static function generateStaticParams():Promise<Array<TodoPageParams>> {
  /* ... */
}
```

The macro validates allowed combinations and emits named exports. Full metadata breadth may be phased; unsupported fields remain available through the raw `Metadata` extern when faithfully bound.

### 11.9 Segment configuration

Expose literal-safe Haxe abstractions for supported segment config values such as runtime, region, dynamic params, revalidation, and maximum duration.

Requirements:

- reject impossible values at Haxe compile time;
- preserve literal values in emitted TypeScript so Next’s plugin can validate them;
- avoid runtime builder objects in the final adapter;
- version-gate removed or changed config keys;
- do not claim experimental options as stable.

### 11.10 Route handlers

Provisional authoring shape:

```haxe
@:next.route("api/todos/[id]")
class TodoRoute {
  @:next.GET
  @:async
  public static function get(
    request:NextRequest,
    context:RouteContext<TodoRouteParams>
  ):Promise<Response> {
    final params = await(context.params);
    return ResponseJson.ok(Todos.find(params.id), TodoCodec);
  }

  @:next.DELETE
  @:async
  public static function delete(
    request:NextRequest,
    context:RouteContext<TodoRouteParams>
  ):Promise<Response> {
    /* authentication, authorization, mutation */
  }
}
```

The adapter emits named `GET`, `DELETE`, and other supported exports. Validation must ensure:

- only supported uppercase HTTP method metadata is used;
- each method appears once;
- async return type is compatible with `Response`;
- context params match the route pattern;
- request-body parsing begins at an unknown boundary and requires a decoder for typed data;
- route handlers do not accidentally receive page-only props;
- cache/runtime config is emitted only when valid for route handlers.

### 11.11 Proxy

`proxy.ts` is P1 because it is root-level, has special matcher/config behavior, and should not block the core App Router slice.

When implemented:

- the Haxe source declares one proxy function;
- the generated file is located at the project root or `src/` as required by the detected app shape;
- matcher configuration is typed and emitted as a literal;
- shared mutable globals are discouraged and documented;
- Node runtime limitations and platform behavior follow Next’s current contract;
- native-owned `proxy.ts` causes a collision rather than an implicit merge.

---

## 12. Server, client, and shared module boundaries

### 12.1 Boundary categories

Every NextJsHx-authored module should be classifiable as one of:

- **server default:** ordinary App Router component/module;
- **client boundary:** requires browser APIs, state, effects, or client hooks;
- **Server Function module:** exports async callable server functions;
- **cache boundary:** applies a supported cache directive to a module/function;
- **shared pure module:** safe in either graph;
- **explicit server-only/client-only module:** marked with side-effect imports and metadata.

The classification is compile-time metadata and generated output behavior, not a new runtime object.

### 12.2 Client components

Provisional shape:

```haxe
@:next.clientComponent
class TodoToggle {
  public static function render(props:TodoToggleProps):Element {
    /* useState, handlers, browser APIs */
  }
}
```

The generated boundary module begins with `"use client"` and imports the genes-ts implementation.

A server Haxe module must not accidentally import the raw implementation module when it intends to render the client boundary. Until generic genes-ts module directives make direct module imports safe, NextJsHx should provide a generated/macro-backed component handle:

```haxe
final Toggle = ClientComponent.ref(TodoToggle);
return JSX.jsx('<Toggle todoId=${todo.id} initialDone=${todo.done} />');
```

or an equivalent ergonomic call locked by ADR. The macro must:

- import the generated client adapter, not the raw implementation;
- keep the implementation reachable despite Haxe DCE not seeing a TS-only adapter import;
- preserve precise props typing;
- avoid emitting `any` or a broad component cast;
- produce a clear diagnostic when a raw client implementation is imported from a server module.

A generic genes-ts module-directive feature may later permit the implementation module itself to be the boundary. That is an optimization/simplification, not permission to weaken tests.

### 12.3 Client prop serializability

Props crossing from a server component to a client component must be serializable by React.

P0 implements a **conservative compile-time allowlist** proven by real Next runtime fixtures. It should accept only values with demonstrated support, initially:

- strings, booleans, integers, finite floats;
- null/undefined where the field type permits them;
- arrays and immutable anonymous structures of allowed values;
- supported string/number enum abstracts;
- React nodes in explicitly supported slot positions;
- generated Server Function references where React permits them;
- additional built-in values only after a positive and negative fixture documents them.

It should reject or require an explicit codec/reference for:

- arbitrary functions;
- class instances;
- browser/server handles;
- opaque `Unknown`;
- native resources;
- cyclic structures;
- maps/sets/dates until the supported line is verified and documented.

The checker is intentionally conservative. A reviewed escape hatch may exist at a narrow boundary, but it must generate a visible comment and a dedicated fixture.

### 12.4 Server Functions and actions

Provisional shape:

```haxe
@:next.serverFunctions("app/todos/actions")
class TodoActions {
  @:next.action
  @:async
  public static function createTodo(formData:FormData):Promise<ActionResult<Todo>> {
    /* validate input, authenticate, authorize, mutate, revalidate */
  }
}
```

Requirements:

- every exported Server Function is async;
- the adapter owns the `"use server"` directive;
- a client component imports the generated action adapter, not the raw server implementation;
- arguments and return values satisfy a conservative React Server Function serialization contract;
- functions may accept `FormData` through a faithful Web API extern;
- authentication and authorization are explicit application responsibilities and prominently documented;
- the semantic guarded-action path requires a closed decoder, current-request
  authenticator, authenticated target resolver, exact-operation authorizer,
  mutation callback, rejection mapping, and public-result projection in one
  inferred config;
- only that guarded pipeline may construct its operation-scoped authorization
  witness, and only after the application callbacks succeed for the current
  invocation;
- guarded control flow proves stage presence, order, and short-circuiting, not
  session freshness, tenant scoping, policy correctness, transaction safety, or
  result secrecy;
- error policy is explicit: thrown framework interrupt, typed result, or documented exception;
- cache invalidation helpers remain direct Next calls;
- no secret/token should be accepted from a client argument when it should be read from cookies or headers.

A generated action ref should remain a normal function from the consumer’s perspective. Do not add a custom RPC envelope to local Next Server Functions.

### 12.5 Cache directives

Next cache directives require precise placement and version-aware semantics. Initial support should be adapter-based:

- module-level `use cache` on generated route/component adapters;
- function-level wrappers around Haxe implementation functions;
- literal-safe `cacheLife` and `cacheTag` helpers;
- direct `revalidatePath`, `revalidateTag`, `updateTag`, and `refresh` bindings.

`use cache: private` and `use cache: remote` are opt-in/experimental according to the selected Next version and require separate capability flags and fixtures.

The library must diagnose known-invalid combinations, such as request APIs inside an ordinary cached scope, but Next’s build remains the final semantic verifier.

### 12.6 Environment poisoning prevention

Provide typed helpers for the ordinary `server-only` and `client-only` side-effect import contracts. NextJsHx macros should add them where appropriate or let the developer add them explicitly.

The generated-output test suite must prove:

- server-only modules fail when imported by a client boundary;
- client-only modules fail in server-only contexts where Next rejects them;
- non-`NEXT_PUBLIC_` environment values are never exposed by a generated browser helper;
- the library does not rely on Next replacing secrets with empty strings as a safety strategy.

---

## 13. Ergonomic APIs

### 13.1 Navigation

Raw bindings preserve `next/navigation`. Semantic helpers may add typed route refs:

```haxe
Navigation.redirect(LoginPage.href());
router.push(TodoPage.href({ id: todo.id }));
```

Requirements:

- preserve redirect’s non-returning control flow in emitted TS where practical;
- distinguish server interrupts from client event navigation;
- keep `push`, `replace`, and `prefetch` names familiar;
- support native `URL` and external URL cases without pretending they are app routes;
- generate a TypeScript parity fixture assigning every Haxe-generated route href to Next’s `Route` type when `typedRoutes` is enabled.

### 13.2 `Link`, `Image`, `Form`, and other components

P0 component wrappers should be thin and typed. They may offer Haxe-native builders only when HXX/TSX authoring is materially clearer.

Example:

```haxe
final Link = NextComponents.link();
return JSX.jsx('<Link href=${TodoPage.href({ id: todo.id })}>Open</Link>');
```

The TypeScript compiler remains the final prop oracle for JSX. Haxe typedefs should still provide completion and catch common errors before code generation.

Do not wrap these components in a runtime component hierarchy merely to rename props.

### 13.3 Request APIs

Provide faithful async wrappers for:

- cookies;
- headers;
- draft mode;
- request URL and `nextUrl`;
- `NextRequest` and `NextResponse`;
- user-agent helpers;
- connection/after APIs where supported.

Semantic helpers may add typed cookie keys, codecs, or header names, but must preserve context restrictions such as where cookies may be mutated.

### 13.4 JSON and form decoding

Introduce a small, reusable codec contract rather than using `Dynamic`:

```haxe
interface Codec<T> {
  function decode(value:Unknown):DecodeResult<T>;
  function encode(value:T):JsonValue;
}
```

The exact codec package may be shared with other Haxe framework projects if already available. NextJsHx owns only framework-specific entry helpers such as:

- `RequestJson.decode(request, codec)`;
- `FormDataDecoder.decode(formData, schema)`;
- `ResponseJson.ok(value, codec)`;
- typed problem/error responses.

A codec system is not required to model internal server-to-server values that never cross a wire or client boundary.

### 13.5 Escape hatches

Documented escape hatches include:

- faithful `nextjs.raw.*` externs;
- `genes.ts.Imports` for a public npm module that lacks a wrapper;
- native TypeScript adapters beside Haxe code;
- a narrow checked boundary wrapper for an unsupported TS type;
- opting a route back to native TypeScript ownership.

Forbidden “escape hatches” include:

- app-level raw emitted TypeScript strings;
- `Dynamic` or `untyped` to bypass prop/action/handler checks;
- editing a generated adapter and expecting the change to survive;
- importing unsupported `next/dist/**` runtime modules as if they were public;
- disabling Next build type errors to make a fixture pass.

---

## 14. Generated output ownership and publication

### 14.1 Ownership manifest

Use `.nextjshx/manifest.json` with an exact schema version. A suggested v1 shape:

```json
{
  "protocol": "nextjshx.generated-output",
  "version": 1,
  "generation": "sha256-of-sorted-path-digests",
  "nextVersion": "16.2.12",
  "genesVersion": "1.27.0",
  "outputs": [
    {
      "path": "src/app/todos/[id]/page.tsx",
      "kind": "app-page-adapter",
      "source": "app.routes.TodoPage",
      "sha256": "..."
    }
  ]
}
```

Every path is project-relative, normalized, and contained under an allowlisted output root.

### 14.2 Write protocol

Before any live mutation:

1. Discover and canonicalize the project root and configured output roots.
2. Reject absolute paths, traversal, duplicate targets, reserved control paths, symlink outputs, and symlink escapes.
3. Read and validate the previous manifest. Unknown versions fail closed.
4. Verify every existing owned file matches its recorded digest.
5. Reject a target that exists without proven NextJsHx ownership.
6. Generate the complete next tree in a staging directory.
7. Format staged TypeScript/TSX using the project’s configured formatter or a deterministic fallback.
8. Parse/syntax-check every staged file.
9. Journal the previous and intended states.
10. Publish changed files and remove stale owned files only.
11. Replace the manifest last, atomically.
12. Run post-publication `next typegen` and strict type checks; on failure, restore the prior adapter tree through the journal and preserve diagnostics.

Unchanged files are not rewritten, reducing unnecessary HMR churn.

### 14.3 Collision behavior

A native-owned `app/todos/page.tsx` colliding with a Haxe-owned planned route is a hard error. The diagnostic must show:

- target path;
- Haxe source claiming it;
- why the existing file is unowned;
- safe choices: rename/move the Haxe route, keep the native route, explicitly adopt ownership, or remove one source.

Do not auto-merge default exports, directives, or named route exports.

### 14.4 Modified generated files

If a manifest-owned adapter’s digest has changed:

- `generate` fails before overwriting anything;
- `clean` fails before deleting anything;
- the diagnostic shows the path and expected/current digest;
- an explicit `nextjshx repair` or `adopt/release` flow is required.

A `--force` flag, if added, must be loud, scoped, and never bypass path/symlink checks. Prefer explicit ownership-transfer commands over a global force switch.

### 14.5 Interrupted generation

Use reserved transaction directories under `.nextjshx/`. On the next command:

- an unpublished staging tree can be removed safely;
- an active journal is rolled back or finalized based on exact hashes;
- any live bytes matching neither previous nor intended state stop recovery;
- malformed/unowned control data is preserved for inspection rather than deleted heuristically.

### 14.6 Clean

`nextjshx clean` reads the same manifest, preflights every owned path, then deletes only verified owned outputs and empty directories containing no native files. A missing manifest means NextJsHx owns nothing.

### 14.7 Files NextJsHx never owns implicitly

- `.next/**`;
- `next-env.d.ts`;
- `node_modules/**`;
- package-manager lockfiles;
- `next.config.*`;
- `tsconfig*.json`;
- native route modules not listed in the manifest;
- public assets;
- deployment configuration;
- environment files.

`init` may propose or apply explicit patches to app-owned config files, but every patch must be diffable, idempotent, and separately recorded from generated adapter ownership.

---

## 15. Tooling and developer workflow

### 15.1 Configuration

Use a simple declarative config, initially `nextjshx.config.json`:

```json
{
  "appRoot": "src/app",
  "haxe": {
    "hxml": "build.hxml",
    "generatedRoot": "src-gen",
    "defines": ["genes.ts", "genes.ts.no_extension"]
  },
  "next": {
    "package": "next",
    "upstreamDir": "../nextjs",
    "typedRoutes": true
  },
  "output": {
    "manifest": ".nextjshx/manifest.json",
    "format": "project"
  }
}
```

The config parser rejects unknown keys by default during the pre-1.0 period so typos do not silently change build behavior. Version the config schema.

### 15.2 `nextjshx init`

Responsibilities:

- detect package manager and workspace root;
- detect `app/` versus `src/app/`;
- verify TypeScript and App Router;
- verify Haxe and genes-ts availability;
- create config, Haxe source roots, baseline hxml, and example route only when paths are absent;
- propose package scripts;
- ensure `src-gen/**`, `.next/**`, and transient transaction paths are ignored as appropriate;
- enable `typedRoutes` only through an explicit reviewed config patch;
- never overwrite a native route or config file;
- print exact follow-up commands.

The command must be idempotent and covered by snapshot/package-shape tests.

### 15.3 `nextjshx generate`

- run the configured Haxe/genes-ts build;
- collect the deterministic adapter plan;
- publish adapters transactionally;
- optionally run `next typegen` and `tsc --noEmit`;
- print changed, unchanged, removed, and blocked outputs;
- leave the last known good live tree untouched on Haxe failure.

### 15.4 `nextjshx dev`

The development command orchestrates rather than replaces Next:

- reserve a fresh loopback port and own one Haxe compilation server for the
  invocation; never attach implicitly to an unknown existing server;
- resolve Lix's Node shim to the real compiler pinned by the nearest `.haxerc`
  for native server protocol, with a reported direct-compilation fallback;
- derive the watch graph from nested HXML, classpaths, resources, scoped
  libraries, config/lock/tool identity, and explicitly declared extra inputs;
- serialize generation runs so two publishers cannot race, and collapse edits
  received during an active compile into one newest-state follow-up;
- debounce only enough to avoid duplicate writes;
- require a successful initial generation or an exact manifest-verified
  last-good tree before starting Next;
- preserve exact last-good generated and adapter bytes on a failed compile,
  then recover on the next valid edit without restarting Next;
- start one `next dev` with reviewed ordinary arguments passed through after an
  explicit separator;
- let Next/Turbopack own HMR and React Fast Refresh;
- prefix diagnostics by source (`haxe`, `nextjshx`, `next`, `tsc`) without
  hiding raw errors; and
- handle interrupt, termination, and hangup during startup or steady state,
  terminating only invocation-owned process groups with bounded escalation.

### 15.5 `nextjshx build`

The production gate is ordered:

1. doctor/version validation;
2. clean Haxe/genes-ts generation;
3. transactional adapter publication;
4. `next typegen`;
5. strict `tsc --noEmit` or equivalent configured typecheck;
6. `next build` with type errors enabled;
7. manifest/stale-output verification.

The command passes ordinary Next build flags through. It does not emulate `next build`.

### 15.6 `nextjshx typecheck`

Runs:

- Haxe typing and macro validation;
- adapter-plan validation without destructive publication where possible;
- Next route type generation;
- TypeScript no-emit check;
- optional generated-route parity check.

### 15.7 `nextjshx routes`

Displays:

- Haxe-owned route modules;
- computed filesystem paths;
- public route patterns;
- dynamic param contracts;
- adapter ownership status;
- native route collisions;
- unsupported route syntax;
- Next typed-route parity status.

JSON output is required for agent/tool use.

### 15.8 `nextjshx doctor`

Checks:

- Haxe version;
- genes-ts version/commit and required defines;
- Node/Next/React/TypeScript versions;
- App Router root;
- config schema;
- upstream sibling availability and exact commit when configured;
- manifest integrity and interrupted transactions;
- app/generated root containment;
- package scripts;
- Next-generated type inclusion;
- duplicate route claims;
- known unsupported features.

Every failure has an actionable message and a stable diagnostic code.

### 15.9 Maintainer commands

- `nextjshx maintain sync-next-surface`;
- `nextjshx maintain verify-next-upstream`;
- `nextjshx maintain snapshot-generated`;
- `nextjshx maintain compatibility-report`.

Do not expose unstable maintenance operations as ordinary application commands.

---

## 16. Gradual adoption and interop

### 16.1 Haxe consuming native TypeScript

Use typed externs and `genes.ts.Imports` for:

- existing TS components;
- third-party React/Next packages;
- native utility functions;
- app-owned Server Functions or route clients where a safe public boundary exists.

A wrapper should live beside app Haxe code and preserve the native module specifier. Do not copy native implementation into generated source.

### 16.2 TypeScript consuming Haxe output

Provide stable, documented generated entrypoints and adapters. Mark Haxe declarations `@:keep` when they are referenced only from TS-authored files because Haxe DCE cannot see those imports.

Package-shape tests must prove:

- named and default imports resolve;
- extensionless imports work under bundler resolution;
- declaration output is usable where published;
- DCE does not silently remove an advertised export.

### 16.3 Native-owned routes

A native route remains fully native. P1 route discovery may generate Haxe route refs from the filesystem and Next typegen output, but it must never regenerate the route implementation.

The discovery tool should fail closed on route constructs it cannot model rather than inventing a wrong public URL.

### 16.4 Haxe-owned routes beside native routes

The manifest may own individual special files within the App Router tree. A directory itself is never assumed to be fully owned. Native CSS, tests, components, and assets may be colocated safely.

### 16.5 Ownership transfer

Provide documented flows:

- **Native to Haxe:** create Haxe source, preview adapter diff, explicitly adopt/remove the native file, then generate.
- **Haxe to native:** materialize or copy the current adapter/implementation into native source, remove Haxe declaration, run generate to remove owned output, then release ownership.

Do not market this as an automatic semantic migration compiler.

---

## 17. Testing and evidence strategy

### 17.1 Testing pyramid

#### Layer A: Haxe API/type tests

Prove externs, abstracts, macros, generated refs, and helper types compile with precise signatures.

#### Layer B: negative compile tests

Prove misuse fails with focused diagnostics. Each negative fixture asserts a stable diagnostic code and useful source position, not only “compiler failed.”

#### Layer C: generated-output snapshots

Commit snapshots for:

- genes-ts TS/TSX modules;
- route adapters;
- client/server/cache directives;
- named/default exports;
- import paths;
- manifest contents;
- init patches;
- compatibility reports.

Snapshots are the primary codegen contract.

#### Layer D: strict TypeScript/package-shape tests

Run TypeScript with strict settings and verify ESM resolution, TSX props, declaration shape, and mixed imports.

#### Layer E: focused Next runtime seams

Use small fixtures for:

- route discovery;
- Next-generated route helpers;
- server/client graph errors;
- Server Function invocation;
- request API context restrictions;
- cache directives;
- special-file export signatures.

#### Layer F: real App Router application

Build and run `examples/todoapp-next` with the supported stable Next package.

#### Layer G: browser E2E

Use Playwright for user-visible flows and hydration/navigation behavior.

#### Layer H: compatibility lanes

Run stable, minimum-supported, local-upstream, and canary/preview lanes according to the matrix. Canary may be allowed to fail initially but must produce a tracked drift report.

### 17.2 Required negative fixtures

At minimum:

- route param name mismatch;
- catch-all type mismatch;
- duplicate route/file claim;
- traversal or absolute adapter path;
- collision with native-owned `page.tsx`;
- changed manifest-owned file blocks regeneration;
- invalid segment config literal;
- non-async Server Function;
- non-serializable Server Function argument/return;
- non-serializable client prop;
- client module importing `next/headers` or explicit server-only code;
- server module using a client hook without a boundary;
- route handler with duplicate/unsupported method;
- route handler returning an incompatible value;
- request JSON read as a domain type without a decoder;
- malformed or depth-invalid parallel/intercepting topology, duplicate view
  ownership, orphan interception, and a named slot without one default;
- public binding drift not covered by an override.

### 17.3 Reference todo application

`examples/todoapp-next` is the production evidence app, not a toy screenshot. It should contain:

- root layout and metadata;
- server-rendered todo list page;
- dynamic todo detail page;
- typed route links and navigation;
- Haxe client component with state/event handling;
- Haxe Server Functions used by a form;
- validation errors represented as typed results;
- create, toggle, and delete flows;
- route handler JSON API with typed decoding/encoding;
- cookies and headers read in valid contexts;
- cache tag/lifetime and revalidation behavior;
- loading UI;
- not-found behavior;
- an error boundary with reset behavior;
- one Haxe component consumed from native TS;
- one native TS component consumed from Haxe;
- one native-owned route beside Haxe-owned routes;
- production `next build` and `next start` verification;
- Playwright coverage for navigation, mutation, hydration, and failure recovery.

Use an intentionally simple persistence layer in P0 so the fixture tests NextJsHx rather than an ORM. A file/in-memory adapter may be used only if deterministic across the tested runtime; otherwise use a small local database with isolated test setup.

### 17.4 CI matrix

Required before a stable release:

| Lane | Frequency | Blocking |
|---|---|---:|
| Haxe 4.3.7 + pinned genes-ts + pinned Next stable | every PR | yes |
| Node minimum + stable Next build | every PR | yes |
| Current pinned LTS + stable Next build/E2E | every PR or merge queue | yes |
| Turbopack/default build | every PR | yes |
| Webpack build parity | nightly until fast enough, then blocking | eventually |
| Local `../nextjs` exact commit package/surface | maintainer/nightly | report, then blocking for declared support |
| Next preview/canary | nightly | non-blocking until promoted |
| Full genes-ts CI for compiler changes | every related PR | yes |
| Dependency/security scan | every PR/release | yes |
| Package/release artifact verification | release | yes |

### 17.5 Performance evidence

Measure before setting rigid budgets. Track:

- cold Haxe + genes-ts generation;
- warm single-module regeneration;
- adapter publication time;
- number of files rewritten per edit;
- Next dev startup delta versus equivalent TS app;
- production bundle delta attributable to NextJsHx runtime helpers.

The architecture target is near-zero runtime overhead beyond ordinary genes-ts output. Adapter files should be tiny and compile-time helpers should not ship.

---

## 18. Diagnostics and developer experience

### 18.1 Stable diagnostic codes

Use categories such as:

- `NXHX-ROUTE-*`;
- `NXHX-BOUNDARY-*`;
- `NXHX-ACTION-*`;
- `NXHX-HANDLER-*`;
- `NXHX-BINDING-*`;
- `NXHX-OWNERSHIP-*`;
- `NXHX-CONFIG-*`;
- `NXHX-UPSTREAM-*`.

Every diagnostic includes:

- what failed;
- the Haxe source and generated target when relevant;
- the expected contract;
- a safe resolution;
- a docs link or local docs path.

### 18.2 Source mapping of generation errors

The adapter plan records Haxe type, field, metadata position, and target path. Collisions and invalid exports should point back to the declaration that requested them.

### 18.3 No hidden fallback to weak typing

When a TypeScript construct cannot be modeled, the tool must report it. It must not silently generate `Dynamic`/`any` or remove a field to keep the build green.

### 18.4 Generated output comments

Keep comments concise:

- generated ownership/source header;
- a comment only where non-obvious scaffolding is required;
- no verbose Haxe internals in normal adapters.

---

## 19. Security requirements

### 19.1 Server Function security

Documentation and examples must require authentication and authorization inside every sensitive Server Function. Generated wrappers do not confer trust.

The selected semantic design is the guarded pipeline in
[ADR 0005](docs/adr/0005-server-function-security-ergonomics.md). It invokes a
closed decoder, request-local application authenticator, authenticated target
resolver, and exact-operation authorizer before constructing a private witness
for the mutation callback. Missing targets and denied policy share a coarse
unavailable result by default, and the domain result must pass through an
explicit public projection.

This is an omission-resistant control-flow contract, not an automatic security
or authorization system. No metadata, body-call scan, broad cast, or generated
adapter may assert that application identity, ownership, tenancy, policy, or
disclosure rules are correct. Native Next origin checks, body-size limits,
action IDs, direct POST reachability, and framework interrupts remain native and
are not reimplemented.

### 19.2 Input validation

Route handler bodies, form fields, search params, headers, and cookies are untrusted. Typed domain values require parsing/decoding before use.

### 19.3 Secret containment

- server-only environment access must not enter client bundles;
- client components may access only explicitly public environment variables;
- generated code never serializes raw environment objects;
- action APIs should read auth from server context rather than accepting caller-supplied tokens when possible.

### 19.4 Path and file safety

All generated paths are normalized, contained, and symlink-checked. Metadata is never concatenated into a shell command or an unchecked import path.

### 19.5 HTML and URL safety

HHX/TSX should rely on React escaping by default. Any raw HTML API requires a strongly named, explicit unsafe wrapper and security documentation. Route refs encode dynamic segments and query values.

### 19.6 Dependency posture

Pin build dependencies, run audits/scanners, and avoid executing arbitrary `next.config` code during static inspection when a package/type manifest is sufficient.

---

## 20. Documentation requirements

Before `v1.0`, ship and maintain:

1. Getting started and prerequisite versions.
2. Mental model: Haxe → genes-ts → adapters → Next.
3. App Router authoring guide.
4. Server/client/shared boundary guide.
5. Server Functions and form mutations.
6. Route handlers and codecs.
7. Navigation, params, and query strings.
8. Metadata and caching.
9. Raw bindings and escape hatches.
10. Generated output ownership and recovery.
11. Gradual adoption in both directions.
12. Upstream compatibility and support matrix.
13. Testing strategy and fixture authoring.
14. Troubleshooting/doctor diagnostic catalog.
15. Publishing Haxe-generated Next components/libraries.
16. Cross-framework ContractHx research addendum when ready.

Every public module/class beyond trivial DTOs receives concise Haxe documentation explaining why it exists, what native contract it preserves, and boundary assumptions.

---

## 21. Release and compatibility policy

### 21.1 Versioning

Use semver. Before `1.0`, breaking authoring changes are allowed only with migration notes and Beads/ADR rationale. Generated manifest and config schemas are versioned independently and fail closed on unknown versions.

### 21.2 Support matrix

`support_matrix.json` is the machine-readable source of truth. It records:

- Haxe version;
- genes-ts version/commit;
- Next stable range and exact tested patch;
- React/React DOM versions;
- Node lanes;
- TypeScript version;
- supported runtimes/bundlers;
- exact fixture commands;
- upstream checkout commit;
- known exclusions.

### 21.3 Stable versus experimental APIs

- stable APIs live under normal `nextjs.*` packages;
- experimental wrappers include explicit metadata/package naming and exact Next version gates;
- raw public Next bindings may expose an upstream unstable name but must preserve that instability in docs;
- no experimental feature is required by the core todo app unless the release is explicitly experimental.

### 21.4 Release evidence

A release is not publishable until:

- clean checkout CI is green;
- generated snapshots match;
- todo app production build and E2E pass;
- package-shape tests pass against packed artifacts;
- manifest/config migration tests pass;
- compatibility report is committed or attached;
- changelog/migration notes are complete;
- artifacts are built from the tested tree and checksummed.

---

## 22. Milestones and release slices

### Milestone 0 — Foundation and decision locks

**Outcome:** a buildable repository with Beads, support matrix, architecture ADRs, and a minimal genes-ts/Next fixture.

Deliverables:

- repository skeleton, CI, licensing, Haxelib/npm workspace setup;
- `bd init`, `bd setup codex`, and project AGENTS rules;
- exact version locks and sibling-path discovery;
- ADRs for adapter strategy, public namespace, route metadata syntax, and ownership protocol;
- minimal Haxe → TSX compile using genes-ts inside a Next app;
- public-entrypoint inventory and surface manifest format;
- compiler-gap inventory with reduced repros.

Exit criteria:

- `next build` succeeds for a hand-written adapter importing one Haxe-generated component;
- no `Dynamic`/`untyped` in framework or fixture code;
- Beads graph is seeded and `bd ready` identifies executable work.

### Milestone 1 — Hello App Router vertical slice (`v0.1.0-alpha`)

**Outcome:** Haxe owns a root layout and page through generated adapters.

Deliverables:

- core React/Next types;
- initial `next/link` and component import proof;
- page/layout metadata macro;
- deterministic adapter plan;
- minimal publisher and ownership manifest;
- generated page/layout snapshots;
- strict TypeScript and stable Next build;
- `examples/hello-next`.

Exit criteria:

- editing Haxe changes rendered output through `next dev`;
- native collision is rejected;
- changed generated file blocks regeneration;
- production build passes.

### Milestone 2 — Typed routing and App Router core (`v0.2.0-alpha`)

**Outcome:** practical multi-route server-rendered application.

Deliverables:

- dynamic/catch-all param validation;
- typed route refs/href generation;
- nested layouts;
- loading, not-found, error boundary;
- metadata and static params;
- segment config;
- `next/navigation` raw and semantic surfaces;
- Next typed-route parity checks.

Exit criteria:

- multi-route fixture has no duplicated route strings outside route declarations/native routes;
- negative param/config/boundary tests pass;
- Next typegen validates generated adapters.

### Milestone 3 — Client boundaries and Server Functions (`v0.3.0-alpha`)

**Outcome:** Haxe-authored interactive full-stack mutations.

Deliverables:

- client component adapters and typed component refs;
- conservative serializability checker;
- React hooks/TSX fixture integration;
- Server Function adapters and action refs;
- `next/form` and `FormData` contracts;
- server-only/client-only enforcement;
- generic genes-ts directive/export work required by the chosen design.

Exit criteria:

- todo create/toggle/delete works from Haxe UI and Haxe Server Functions;
- invalid client props/actions fail before Next runtime;
- Next build verifies graph boundaries;
- related genes-ts full CI is green.

### Milestone 4 — Route handlers, request APIs, and cache (`v0.4.0-alpha`)

**Outcome:** typed backend-for-frontend capabilities inside Next.

Deliverables:

- `NextRequest`/`NextResponse`;
- route handler method adapters;
- typed JSON/form codec helpers;
- cookies, headers, draft mode;
- cache/revalidation APIs and directives;
- focused security docs and negative tests.

Exit criteria:

- JSON API and request-context flows work in the todo app;
- malformed payloads produce typed responses;
- cache/revalidation behavior has runtime evidence.

### Milestone 5 — Tooling, ownership hardening, and gradual adoption (`v0.5.0-beta`)

**Outcome:** credible daily development workflow in existing Next apps.

Deliverables:

- `init`, `generate`, `dev`, `build`, `typecheck`, `routes`, `doctor`, `clean`;
- transactional journal/recovery;
- idempotent config patches;
- mixed TypeScript/Haxe examples both directions;
- native route discovery/refs for supported shapes;
- package manager/workspace tests;
- complete ownership docs.

Exit criteria:

- interrupted generation recovers safely;
- native app adoption fixture remains native-owned where intended;
- watch loop preserves last good output after Haxe errors;
- no command deletes or overwrites unowned content in adversarial tests.

### Milestone 6 — Compatibility and production evidence (`v1.0.0-rc`)

**Outcome:** release candidate with declared stable support.

Deliverables:

- full todo app and Playwright suite;
- minimum/current Node lanes;
- Turbopack and Webpack evidence as declared;
- upstream `../nextjs` compatibility report;
- stable/canary drift automation;
- package/release verification;
- complete public docs and diagnostics catalog;
- performance baseline.

Exit criteria:

- every stable feature has the required evidence set;
- support matrix and docs agree;
- packed artifacts work in a clean consumer fixture;
- no P0/P1 security, ownership, or type-safety Bead remains open.

### Milestone 7 — Post-1.0 breadth

Candidates:

- instrumentation and remaining root conventions;
- metadata routes and image generation;
- Edge runtime qualification;
- Pages Router interop/authoring;
- route discovery across monorepos/multi-zones;
- richer generated route registry;
- framework adapter/deployment integration;
- experimental Next features behind capability gates.

---

## 23. Definition of done

A NextJsHx feature is complete only when all applicable conditions are met:

- Bead acceptance criteria are satisfied and the Bead is closed.
- Haxe API is precisely typed and documented.
- No unexplained `Dynamic`, `untyped`, generated `any`, broad `unknown`, or blanket cast is introduced.
- Generated TS/TSX snapshot is committed and readable.
- Strict TypeScript check passes.
- Negative misuse fixture exists where appropriate.
- Next stable build/runtime consumes the output where framework behavior matters.
- Generated ownership and cleanup behavior is covered if files are written.
- Compatibility/support metadata is updated.
- User docs and migration notes are updated.
- Any genes-ts change passes full genes-ts CI in both output modes.
- Git and Dolt synchronization follow the active AGENTS/Beads context profile. Under the default conservative profile, Codex reports status and proposed commands rather than committing or pushing without explicit authority.

The project is `1.0`-ready only when the release-candidate milestone exit criteria and the production-readiness checklist are all green.

---

## 24. Open decisions and recommended defaults

These decisions should become explicit ADR Beads during Milestone 0.

| Decision | Recommended default |
|---|---|
| Product spelling | `NextJsHx` in prose, `nextjshx` for package/CLI/repo |
| Haxe public namespace | `nextjs.*` |
| Initial router | App Router only |
| Generated import style | extensionless via `-D genes.ts.no_extension` for Next bundler projects |
| Generated implementation root | `src-gen/` |
| App adapter root | detected `app/` or `src/app/` |
| Config file | versioned `nextjshx.config.json` |
| Route declaration | class metadata with segment path; generated per-route refs |
| Params | explicit typedef in P0, macro-validated; generated companion types later |
| Adapter ownership | manifest + SHA-256, staging, journal, fail closed |
| CLI implementation | native TypeScript first; Haxe dogfood where it improves maintainability |
| Next version | pinned stable patch plus exact upstream commit report |
| React | React 19 primary |
| Client serialization | conservative allowlist, expanded only by evidence |
| Server Function transport | native Next/React behavior, no custom envelope |
| Native route coexistence | file-level mixed ownership; never auto-merge |
| `next-env.d.ts` | Next-owned, ignored, never edited |
| Experimental Next APIs | separate gated namespace/capability |
| Pages Router | post-core compatibility track |

---

## 25. Codex execution contract

### 25.1 One-time Beads bootstrap

The planning pack includes `nextjshx-beads-seed.json` and the validated `nextjshx-seed-beads.py` bootstrap helper. From the new repository, inspect and import the graph once:

```bash
bd init --prefix nxhx
bd setup codex --check
bd prime
python path/to/nextjshx-seed-beads.py --dry-run
python path/to/nextjshx-seed-beads.py
```

The helper creates issues, parent relationships, labels, acceptance criteria, and blocking edges, while keeping a resumable alias-to-ID import log under `.beads/`. It does not commit, push, or initialize remotes. After import, Beads—not the seed files—is the execution source of truth.

### 25.2 Per-session workflow

Codex should begin every session with:

```bash
bd prime
bd ready
```

Then:

1. Select an unblocked Bead and inspect it fully with `bd show`.
2. Claim atomically with `bd update <id> --claim` or the current Beads equivalent.
3. Read the relevant reference project and upstream Next public contract before coding.
4. Implement the smallest coherent vertical slice.
5. Add snapshots, negative tests, runtime evidence, and docs in the same slice.
6. Create fully described `discovered-from` Beads for newly discovered work; do not leave Markdown TODOs.
7. Run focused tests while iterating, then all required gates before closure.
8. Close the Bead with a concrete reason and verification commands.
9. Update the Bead and report the working-tree, test, and synchronization state. Commit or sync only when the active AGENTS profile or the current user explicitly authorizes it.
10. When authorized, use a beginner-readable commit body, pull/rebase as appropriate, run `bd dolt push` when a Dolt remote is configured, push Git changes, and verify synchronization. Otherwise, report the exact proposed commands without executing them.

Additional rules:

- Treat `../nextjs` and other reference sibling repositories as read-only unless the user explicitly assigns work there.
- If a genes-ts change is needed, create/link a dedicated compiler Bead, reduce the issue to a generic fixture, and stop downstream dependence until full genes-ts CI is green.
- Do not create a local NextJsHx workaround that encodes one Next route path/module name into the compiler.
- Do not weaken TypeScript or Next build checks to close a Bead.
- When a design is ambiguous or risks a clever workaround, create a `decision` Bead (and `adr` label where appropriate) with the reduced problem, alternatives, tradeoffs, and a recommended choice.

---

## 26. Bonus addendum: ContractHx for NextJsHx + PhoenixHx/RailsHx

### 26.1 Priority and intent

This is deliberately low priority until NextJsHx’s local App Router, Server Function, route-handler, ownership, and codec foundations are stable.

The opportunity is to make a NextJsHx frontend consume a PhoenixHx or RailsHx backend from one Haxe-authored contract with generated typed helpers on both ends. The right model is **not** “make Phoenix/Rails run like Next” and not “replace HTTP with a new runtime.” It follows the PhoenixHx Live Event Protocol and RailsHx typed Hotwire contract pattern: one boring shared declaration removes duplicated names, payload fields, codecs, and error shapes while every framework retains its native router/controller/channel/action model.

Working name: **ContractHx**. Naming remains an ADR.

### 26.2 Recommended architecture

```text
shared Haxe domain + service contract
          │
          ├─ generated schema/codecs/contract hash
          │
          ├─ NextJsHx client
          │    ├─ server-side fetch client
          │    ├─ browser fetch client where allowed
          │    ├─ typed route/query/body/error helpers
          │    └─ optional React hooks are a thin convenience layer
          │
          ├─ PhoenixHx adapter
          │    ├─ Phoenix router/controller functions
          │    ├─ JSON codecs and problem responses
          │    └─ optional Channels/LiveView events later
          │
          └─ RailsHx adapter
               ├─ Rails routes/controller actions
               ├─ JSON codecs and problem responses
               └─ optional ActionCable/Hotwire events later
```

### 26.3 Provisional contract shape

```haxe
@:contract.service("todos", version = 1)
interface TodoService {
  @:contract.GET("/todos")
  function list(query:ListTodosQuery):Promise<Result<Array<Todo>, TodoError>>;

  @:contract.POST("/todos")
  function create(body:CreateTodo):Promise<Result<Todo, TodoError>>;

  @:contract.DELETE("/todos/:id")
  function delete(id:TodoId):Promise<Result<Deleted, TodoError>>;
}
```

The declaration is transport-neutral enough to generate native adapters but explicit enough to review. It should not contain Next, Phoenix, or Rails implementation concepts.

### 26.4 HTTP JSON first

The first transport profile should be ordinary HTTP JSON because it is:

- supported natively by all three frameworks;
- easy to inspect and test;
- compatible with SSR and browser clients;
- deployable without a shared runtime process;
- representable as OpenAPI/JSON Schema if useful.

Streaming/event transports are later profiles:

- Phoenix Channels / LiveView events;
- Rails ActionCable / Turbo/Hotwire updates;
- SSE or WebSocket client helpers in Next.

Do not force event semantics through the HTTP profile or vice versa.

### 26.5 Generated artifacts

A contract compiler may generate:

- codecs for request, response, and typed error variants;
- route path builders;
- Next server/client fetch functions;
- Phoenix router/controller binding helpers;
- Rails route/controller binding helpers;
- contract manifest containing names, schema hashes, version, and transports;
- optional OpenAPI/JSON Schema documents;
- compile-time and runtime contract-hash checks in development/test.

Generated server adapters should call app-owned implementation interfaces. They must not hide framework request/response objects when native access is needed; provide a typed context escape hatch.

### 26.6 Same-origin/BFF integration

The easiest secure deployment shape is often:

- browser talks to Next on one origin;
- Next Route Handlers or server components call Phoenix/Rails server-side;
- auth cookies/headers are forwarded through an explicit allowlist;
- backend URLs and secrets stay server-only.

Tooling could generate a BFF/proxy layer and environment contract:

```bash
nextjshx bridge init --backend phoenix
nextjshx bridge init --backend rails
```

This command could create:

- server-only backend client config;
- typed environment declarations;
- local development proxy/rewrite examples;
- CSRF/CORS guidance;
- credential-forwarding policy;
- health/contract version checks.

It must not automatically forward every header/cookie.

### 26.7 Security and framework differences

The bridge must model rather than erase differences:

- Phoenix Plug/Phoenix auth and CSRF behavior;
- Rails session, forgery protection, and strong-parameter conventions;
- Next server/browser credential contexts;
- cookie domain, SameSite, and HTTPS constraints;
- SSR request cancellation/timeouts;
- framework-native error/logging/telemetry hooks.

Generated clients should have explicit timeout, cancellation, retry, and idempotency policy. Retries are never automatic for mutations unless the contract declares safety.

### 26.8 Relationship to Next Server Functions

Next Server Functions are local Next/React boundaries and should remain native. ContractHx is for a network boundary or cross-process backend. Do not make every local action an HTTP RPC merely for uniformity.

A Next Server Function may call a generated ContractHx server client when that is the appropriate BFF shape.

### 26.9 Relationship to existing PhoenixHx/RailsHx protocols

Reuse concepts and, where practical, shared codec/schema infrastructure from:

- PhoenixHx Live Event Protocols;
- RailsHx typed Hotwire/ActionCable contracts;
- existing shared Haxe domain packages.

Do not create three incompatible annotation systems. A small core contract model can have framework-specific adapter packages:

```text
contracthx-core
contracthx-nextjshx
contracthx-phoenixhx
contracthx-railshx
```

This packaging is a research hypothesis, not a core NextJsHx commitment.

### 26.10 Research milestones

#### Bridge R0 — architecture spike

- inventory existing PhoenixHx and RailsHx protocol/codecs;
- write one todo list/create contract;
- compare generated native artifacts for all three frameworks;
- decide core schema/codec ownership;
- document auth/CSRF/deployment tradeoffs;
- no public API promise.

#### Bridge R1 — HTTP JSON proof

- Next server-side client;
- one PhoenixHx server adapter;
- one RailsHx server adapter;
- shared positive/negative contract tests;
- contract hash and drift diagnostic;
- no browser hooks or streaming yet.

#### Bridge R2 — ergonomic tooling

- `bridge init`;
- environment and same-origin/BFF templates;
- generated API client façade;
- OpenAPI/JSON Schema optional output;
- real Next + Phoenix and Next + Rails E2E fixtures.

#### Bridge R3 — events/streaming research

- choose explicit transport profiles;
- map Phoenix Channels/LiveView and Rails ActionCable/Hotwire without pretending they are identical;
- add Next client helpers only where a shared protocol removes real duplication.

### 26.11 Bridge non-goals

- a framework-agnostic application runtime;
- transparent distributed calls that look local;
- automatic database model sharing;
- automatic auth/session unification;
- replacing Phoenix controllers, Rails controllers, Next Route Handlers, or Server Functions;
- code generation from arbitrary application source;
- universal streaming semantics.

### 26.12 Bridge acceptance bar

The addendum earns product status only when:

- one shared declaration generates typed, readable, native adapters for Next + Phoenix and Next + Rails;
- malformed payloads fail safely on each server;
- client and server schema drift is detected;
- auth/CSRF/cookie handling is explicit;
- generated code contains no broad `Dynamic`/`any` wire model;
- framework developers can debug requests with ordinary tools;
- removing ContractHx leaves ordinary framework concepts rather than an opaque runtime dependency.

---

## 27. Source references used for implementation planning

Primary upstream/reference locations:

- Next.js repository: `https://github.com/vercel/next.js/`
- Next.js App Router documentation: `https://nextjs.org/docs/app`
- Next.js TypeScript configuration and route-aware types: `https://nextjs.org/docs/app/api-reference/config/typescript`
- Next.js page convention: `https://nextjs.org/docs/app/api-reference/file-conventions/page`
- Next.js route handler convention: `https://nextjs.org/docs/app/api-reference/file-conventions/route`
- Next.js proxy convention: `https://nextjs.org/docs/app/api-reference/file-conventions/proxy`
- Next.js server/client components: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js `use server`: `https://nextjs.org/docs/app/api-reference/directives/use-server`
- Next.js `use cache`: `https://nextjs.org/docs/app/api-reference/directives/use-cache`
- Beads: `https://github.com/gastownhall/beads`
- Supplied genes-ts, PhoenixHx, and RailsHx snapshots in the task context.

For implementation, use the exact pinned package declarations and the configured `../nextjs` checkout rather than treating documentation prose alone as an API signature oracle.
