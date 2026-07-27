# Architecture

NextJsHx is a typed Haxe authoring layer for ordinary Next.js applications. Its
core build path is:

```text
Haxe source
  → closed config validation and package/workspace/App Router discovery
  → Haxe type checking and NextJsHx build macros
  → validated route patterns and exact parameter bindings
  → validated, versioned adapter plan
  → genes-ts split ESM TypeScript/TSX
  → narrow Next-native convention adapters
  → pure manifest/digest/collision preflight
  → journaled manifest-owned publication
  → CLI-orchestrated next typegen and strict TypeScript
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
| [0003](adr/0003-boundary-classification-and-import-graph-enforcement.md) | Boundary classification and import-graph enforcement | One Haxe module has one primary graph classification; native client/action crossings use generated typed refs, DCE retention is targeted, and Haxe guards complement rather than replace strict TypeScript and `next build`. |
| [0004](adr/0004-haxe-native-react-component-authoring.md) | Haxe-native React component authoring | Reusable Server Components remain ordinary Haxe functions; Client Component declarations infer private adapters and expose caller-sensitive `.client()` refs through an explicit static extension, while React/Next retain their native graph and runtime. |
| [0005](adr/0005-server-function-security-ergonomics.md) | Non-deceptive Server Function security ergonomics | Sensitive actions use an explicit guarded pipeline that invokes application decoding, current-request authentication, target resolution, and exact-operation authorization before creating a private witness; an explicit projection selects public output, while policy correctness remains application-owned. |
| [0006](adr/0006-haxe-native-react-hook-authoring.md) | Haxe-native React Hook authoring | Raw React tuples remain faithful while allocation-free semantic state, explicit memo dependencies, and typed Hook export adapters make Haxe authoring safer and preserve bidirectional TypeScript interop. |
| [0007](adr/0007-reviewed-npm-package-integrations.md) | Reviewed npm package integrations | Third-party support is exact-versioned and declaration-drift-checked; precise raw externs, semantic Haxe facades, source-owned TSX, and native package runtimes retain explicit ownership. |

## System boundaries

### Haxe and genes-ts

- Application behavior is authored in app-owned `.hx` files.
- Faithful public Next bindings live under `nextjs.raw.*`; supported semantic
  APIs live under `nextjs.*`, while `nextjs._internal.*` and `nextjshx.*` are
  not application-facing compatibility surfaces.
- The versioned [public binding inventory](binding-policy.md) selects public
  `next/*` exports before generation. Internal declaration origins are tracked
  separately, carry no compatibility promise, and never authorize a
  `next/dist/**` runtime import.
- A second versioned binding IR ingests only those signature-matched declaration
  nodes, records exact Next/TypeScript identities and owning fixtures, applies a
  small reviewed safety-override set, and fails before Haxe emission on an
  unsupported TypeScript construct. Checked IR changes pass through the
  classified drift and exact transition gate documented in the same policy.
- Mechanically provable bindings are generated; API-shaped raw bindings may be
  curated only through the signature-locked implementation manifest. Curated
  source bytes are hashed into the IR, remain tied to an owner and strict
  fixture, and may neither use `Dynamic` nor import `next/dist/**` at runtime.
- Generated raw Haxe types must preserve both Haxe ergonomics and the exact
  TypeScript contract after genes-ts emission; a Haxe-only closed type that
  widens in emitted TypeScript does not satisfy the binding contract.
- The Haxe layer should improve authoring UX where it can do so compatibly:
  closed literal abstracts, target-inferred records, earlier read-only errors,
  and exact non-returning output are preferred to stringly or runtime-only
  failures. A verified Next.js shortcoming may be smoothed by a documented
  stable narrowing, but public behavior and strict Next validation remain the
  oracle.
- Next components whose natural Haxe names overlap intrinsic HTML tags expose
  JSX-safe semantic values under `nextjs.components.Next*`. They retain the
  faithful `nextjs.raw.components.*` prop types and exact public Next imports;
  the names prevent HXX component-identity ambiguity and add no wrapper.
- One annotated application class declares one route or module boundary.
  Metadata paths are relative to the discovered App Router root and are never
  inferred solely from the Haxe package.
- Route declarations first pass the closed, fail-closed path and exact params
  contract documented in the [route-pattern reference](route-patterns.md).
- NextJsHx macros validate supported Next contracts and emit a deterministic
  adapter plan. Its closed schema and canonical ordering are documented in the
  [adapter-plan reference](adapter-plan.md).
- Page and layout declarations use semantic Promise-shaped props, exact route
  params, element results, readonly URL input, and injected inline page hrefs.
  A page may add a closed outbound query schema without treating incoming URL
  input as trusted; see the [page/layout reference](pages-and-layouts.md) and
  [typed-query reference](route-queries.md).
- Metadata, generated static params, and segment config use semantic Haxe
  contracts, exact route matching, compile-time-only literal markers, and
  direct native Next exports; see the
  [metadata and segment-config reference](metadata-and-segment-config.md).
- Route Handler declarations turn lower-camel Haxe methods into validated named
  HTTP exports while preserving Promise-shaped params and Next's independent
  route-literal check; see the [Route Handler reference](route-handlers.md).
- External JSON, native form data, and URL queries cross one explicit
  `genes.ts.Unknown` or text boundary and are immediately decoded into closed
  values. Semantic codecs add exhaustive Haxe results, deterministic issues,
  and precise native Next JSON responses without a second transport runtime;
  see the [codec reference](codecs.md).
- Server-default, client, Server Function, shared-pure, explicit
  server/client-only, and cache classifications follow one-module semantics.
  Only generated component/action/cache refs cross native graph entries; Haxe owns
  early local diagnostics and targeted DCE retention while strict TypeScript,
  `next build`, and runtime evidence remain mandatory for the final graph; see
  [ADR 0003](adr/0003-boundary-classification-and-import-graph-enforcement.md).
  Explicit server/client-only markers, named server environment access, and
  their executable containment evidence are documented in the
  [environment-boundary reference](environment-boundaries.md).
  [ADR 0004](adr/0004-haxe-native-react-component-authoring.md) defines the
  current Haxe-native authoring contract: reusable Server Components remain implicit,
  zero-argument client declarations infer private adapters, and an explicit
  static extension provides caller-sensitive `Component.client()` refs.
  Explicit paths and `ClientComponent.ref` remain compatibility forms; the
  conservative prop contract and migration guidance are documented in the
  [Client Component reference](client-components.md).
  [ADR 0006](adr/0006-haxe-native-react-hook-authoring.md) defines faithful raw
  state tuples, allocation-free semantic state and memo intent, explicit
  dependency packaging, and directive-first typed Hook publication; see the
  [React Hook and interop reference](react-hooks.md).
  Cached functions similarly use precise generated refs, while module-cached
  pages/layouts own first-position directives and the native Next runtime; see
  the [Cache Components reference](cache-components.md).
- Loading, error, and not-found declarations retain Next's server/client modes
  and exact convention filenames. The semantic error props expose a precise
  Error and reset callback while the macro owns the required client directive;
  see the [special-file reference](special-files.md).
- A proxy declaration keeps its typed request behavior and optional matcher
  literals in Haxe while emitting Next's ordinary root `proxy.ts`; exact
  placement, public `NextProxy`/`ProxyConfig` checks, and native collision
  behavior are documented in the [proxy reference](proxy.md).
- genes-ts emits strict split ESM TypeScript/TSX implementation modules.
- Generic compiler gaps are reduced and fixed in genes-ts without adding
  Next-specific concepts to the compiler.
- Maintained showcase sites exercise semantic authoring, native ecosystem
  interop, strict production builds, and responsive hydration through one
  deterministic matrix; source-owned shadcn internals remain TSX behind exact
  Haxe facades. See the [showcase guide](showcases.md).
- Reviewed third-party packages follow the precise-or-omitted boundary in
  [ADR 0007](adr/0007-reviewed-npm-package-integrations.md). Exact npm,
  lockfile, license, public export, declaration digest, owned-source, and
  evidence identities live in a schema-validated inventory; the operational
  workflow is in the [package integration guide](package-integrations.md).

### Next convention adapters

- Adapters materialize exact App Router paths, directives, default exports,
  named exports, and public TypeScript signatures.
- Segment config is revalidated against the plan's exact Next version and
  rendered as direct literal exports that Next's TypeScript plugin can inspect.
- Client components, exported Haxe Hooks, Server Functions, and cached functions are consumed
  through macro-backed typed references to their generated boundary adapters,
  not raw implementation imports. Their declarations, refs, value contracts,
  and security boundaries are specified in
  [client-components.md](client-components.md),
  [react-hooks.md](react-hooks.md),
  [server-functions.md](server-functions.md), and
  [cache-components.md](cache-components.md).
- Sensitive Server Functions have a separate semantic security contract in
  [ADR 0005](adr/0005-server-function-security-ergonomics.md). The guarded
  pipeline makes decoder, current-request authenticator, target resolver,
  exact-operation authorizer, mutation, rejection mapping, and public-result
  projection structurally explicit. Only the pipeline constructs its scoped
  authorization witness. These mechanics improve omission resistance without
  certifying application session, tenancy, ownership, policy, transaction, or
  disclosure correctness.
- Adapters contain no business logic and delegate to genes-ts output.
- NextJsHx owns only files named in its validated ownership manifest. A
  directory is never treated as wholly owned.
- Existing native files remain application-owned and collisions fail closed.
- Root `proxy.ts` is authorized as one exact-file capability outside the broad
  App Router output root; neither the package root nor all of `src/` becomes
  generated-owned.
- Publication holds one project lock, stages and parses the complete tree,
  journals exact previous/intended digests, replaces the manifest last, and
  rolls back failed strict validation. Recovery never acts on ambiguous bytes;
  see [generated-output publication](generated-output-publication.md).

### Next.js validation

- `next typegen` supplies route-aware helpers such as `PageProps`,
  `LayoutProps`, and `RouteContext`.
- Strict TypeScript checks the generated bridge against Next's public contract.
- `next build` remains a mandatory integration oracle; Haxe validation does not
  replace it.

### Host CLI

- The CLI is an orchestrator, not an application runtime. It validates one
  declarative config and invokes Haxe, Next, TypeScript, and optional Git source
  identity checks directly without a shell.
- Every Haxe command receives a unique adapter-plan output path plus validated
  App Router and generated-output roots; a successful process cannot satisfy
  the CLI with a stale fixed plan or user-shadowed import roots.
- `generate` is the primitive command that publishes adapters; `build` invokes
  that same transaction as part of the production gate. `typecheck` and
  checked route reporting require the freshly rendered tree to match the
  verified live manifest before claiming Next/TypeScript parity.
- `build` never emulates Next. It runs doctor, safely cleans only the configured
  Haxe generated root, generates and publishes, runs Next typegen and strict
  TypeScript, invokes the pinned `next build`, then recompiles a no-output plan
  and proves every manifest-owned adapter is still current.
- Machine JSON preserves stable config, plan, ownership, transaction, and CLI
  diagnostic families. The complete behavior is documented in the
  [CLI reference](cli.md).

## Non-negotiable invariants

- Generated output is short, deterministic, formatted, and reviewable.
- No broad cast, `any`, `Dynamic`, or `untyped` seam is used to silence a
  framework mismatch.
- No native route, config file, asset, environment file, or deployment file is
  overwritten implicitly.
- Unchanged generated files retain their inode, timestamp, and mode; interrupted
  publication is resumed or rolled back only from exact journaled hashes.
- Server/client boundaries use native React and Next directives and module
  behavior.
- Server environment access is named and server-only; no semantic client API
  exposes the complete process environment.
- Route declarations are per-type; any aggregate route façade is generated from
  the validated manifest and is never a manually maintained registry.
- Compiler changes remain generic and pass genes-ts TypeScript and classic-JS
  evidence.
- The support matrix distinguishes declared targets from verified support.

Live architecture work remains in Beads. This document indexes accepted
contracts; it is not a second backlog.
