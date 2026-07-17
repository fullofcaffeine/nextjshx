# Architecture

NextJsHx is a typed Haxe authoring layer for ordinary Next.js applications. Its
core build path is:

```text
Haxe source
  → Haxe type checking and NextJsHx build macros
  → validated route patterns and exact parameter bindings
  → validated, versioned adapter plan
  → genes-ts split ESM TypeScript/TSX
  → narrow Next-native convention adapters
  → next typegen and strict TypeScript
  → next dev/build/start
```

Next.js remains the runtime, router, React Server Components implementation,
compiler, bundler, and deployment model. NextJsHx owns typed declarations,
compile-time validation, adapter intent, and explicitly manifest-owned generated
files. It does not introduce a parallel router or application runtime.

## Normative sources

The sources have distinct responsibilities:

1. [The PRD](../nextjshx-prd.md) defines the product and default architecture.
2. Accepted [architecture decision records](adr/README.md) refine or supersede
   the PRD for their stated scope.
3. [The support matrix](../support_matrix.json) records exact compatibility and
   evidence identities.
4. Beads records live work, dependencies, ownership, and completion evidence.

An implementation must not silently change an accepted decision. Material
changes require a superseding ADR and linked Beads work.

## Accepted decisions

| ADR | Decision | Consequence |
| --- | --- | --- |
| [0001](adr/0001-adapter-first-app-router-integration.md) | Adapter-first App Router integration | Next convention files are narrow, deterministic, manifest-owned adapters unless a future direct-emission path satisfies the recorded admission criteria. |
| [0002](adr/0002-public-namespace-and-app-router-authoring.md) | Public namespace and App Router authoring syntax | Raw Next bindings remain available under `nextjs.raw.*`; semantic APIs and per-type `@:next.*` declarations produce typed adapter intent without a manually maintained route registry. |

## System boundaries

### Haxe and genes-ts

- Application behavior is authored in app-owned `.hx` files.
- Faithful public Next bindings live under `nextjs.raw.*`; supported semantic
  APIs live under `nextjs.*`, while `nextjs._internal.*` and `nextjshx.*` are
  not application-facing compatibility surfaces.
- One annotated application class declares one route or module boundary.
  Metadata paths are relative to the discovered App Router root and are never
  inferred solely from the Haxe package.
- Route declarations first pass the closed, fail-closed path and exact params
  contract documented in the [route-pattern reference](route-patterns.md).
- NextJsHx macros validate supported Next contracts and emit a deterministic
  adapter plan. Its closed schema and canonical ordering are documented in the
  [adapter-plan reference](adapter-plan.md).
- genes-ts emits strict split ESM TypeScript/TSX implementation modules.
- Generic compiler gaps are reduced and fixed in genes-ts without adding
  Next-specific concepts to the compiler.

### Next convention adapters

- Adapters materialize exact App Router paths, directives, default exports,
  named exports, and public TypeScript signatures.
- Client components and Server Functions are consumed through macro-backed
  typed references to their generated boundary adapters, not raw implementation
  imports.
- Adapters contain no business logic and delegate to genes-ts output.
- NextJsHx owns only files named in its validated ownership manifest. A
  directory is never treated as wholly owned.
- Existing native files remain application-owned and collisions fail closed.

### Next.js validation

- `next typegen` supplies route-aware helpers such as `PageProps`,
  `LayoutProps`, and `RouteContext`.
- Strict TypeScript checks the generated bridge against Next's public contract.
- `next build` remains a mandatory integration oracle; Haxe validation does not
  replace it.

## Non-negotiable invariants

- Generated output is short, deterministic, formatted, and reviewable.
- No broad cast, `any`, `Dynamic`, or `untyped` seam is used to silence a
  framework mismatch.
- No native route, config file, asset, environment file, or deployment file is
  overwritten implicitly.
- Server/client boundaries use native React and Next directives and module
  behavior.
- Route declarations are per-type; any aggregate route façade is generated from
  the validated manifest and is never a manually maintained registry.
- Compiler changes remain generic and pass genes-ts TypeScript and classic-JS
  evidence.
- The support matrix distinguishes declared targets from verified support.

Live architecture work remains in Beads. This document indexes accepted
contracts; it is not a second backlog.
