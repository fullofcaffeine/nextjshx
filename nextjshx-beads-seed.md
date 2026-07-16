# NextJsHx Beads Seed Backlog

- **Generated:** 2026-07-16
- **Suggested prefix:** `nxhx`
- **Companions:** `nextjshx-prd.md`, `nextjshx-beads-seed.json`, `nextjshx-seed-beads.py`

> This is a one-time bootstrap specification. After the issues are created, Beads is the execution source of truth. Do not maintain status here. Run `bd prime` first so the installed Beads version supplies current command syntax.

## Seeding workflow

1. Initialize the project with `bd init --prefix nxhx` (or the team-selected prefix) and verify Codex integration with `bd setup codex --check`.
2. Create `NXHX-ROOT` first and record the actual generated ID.
3. Create milestone epics, then child issues, replacing each planning alias with its actual ID.
4. Use `--parent <actual-epic-id>` for hierarchy. Use the current built-in `epic`, `feature`, `task`, and `decision` types; research intent stays in labels.
5. Add blocking dependencies in requirement direction: `bd dep add <dependent> <required>`.
6. Verify the graph with `bd ready`, `bd blocked`, `bd dep cycles`, `bd dep tree`, and `bd lint`.
7. Store the alias-to-ID map in an immutable import log or Beads note, not as a second status tracker.
8. Follow the active Beads agent context profile for Git and Dolt synchronization; do not infer commit or push authority from this seed.

Priority semantics: P0 is reserved for security, data-loss, environment-containment, and generated-publication safety; P1 is major core work; P2 is medium-priority breadth/ergonomics; P3 is low-priority research.

## Graph summary

- **NXHX-ROOT — Build NextJsHx: typed Haxe authoring for Next.js via genes-ts** (P1; depends on —)
- **NXHX-E0 — Milestone 0: foundation, repository, and architecture locks** (P1; depends on —)
- **NXHX-E1 — Generic genes-ts capabilities required by NextJsHx** (P1; depends on —; entry work gated by NXHX-F05)
- **NXHX-E2 — Public Next.js bindings and faithful raw surface** (P1; depends on —; entry work gated by NXHX-F06)
- **NXHX-E3 — App Router declarations, route model, and generated adapters** (P1; depends on —; entry work gated by NXHX-F03 and NXHX-F04)
- **NXHX-E4 — Server/client boundaries, Server Functions, and cache semantics** (P1; depends on NXHX-E3)
- **NXHX-E5 — CLI, safe generated ownership, watch loop, and gradual adoption** (P1; depends on —; entry work gated by NXHX-F03)
- **NXHX-E6 — Examples, production evidence, compatibility, docs, and release** (P1; depends on NXHX-E2, NXHX-E3, NXHX-E4, NXHX-E5)
- **NXHX-E7 — Low-priority ContractHx interoperability research** (P3; depends on —; entry work gated by NXHX-C07 and NXHX-R04)

## Issue specifications

### NXHX-ROOT — Build NextJsHx: typed Haxe authoring for Next.js via genes-ts

- **Type:** `epic`
- **Priority:** P1
- **Parent:** root
- **Depends on:** none
- **Labels:** `nextjshx`, `root`
- **PRD sections:** 1, 22, 23

Deliver the framework-first NextJsHx product described by the PRD: faithful Next public bindings, Haxe-native App Router ergonomics, generated Next-native adapters, safe ownership, real-app evidence, and a releasable toolchain.

**Acceptance criteria**

- All blocking milestone epics are closed.
- The declared support matrix is green.
- No open P0/P1 security, ownership, type-safety, or release blockers remain.
- The production todo app and packed consumer fixture pass from a clean checkout.

### NXHX-E0 — Milestone 0: foundation, repository, and architecture locks

- **Type:** `epic`
- **Priority:** P1
- **Parent:** `NXHX-ROOT`
- **Depends on:** none
- **Labels:** `milestone-0`, `foundation`
- **PRD sections:** 2, 8, 22

Establish the repository, Beads/Codex workflow, exact support baseline, architecture decisions, and a minimal Haxe-to-Next proof.

**Acceptance criteria**

- All child tasks are closed.
- A clean checkout can run the baseline CI and build the minimal Next fixture.

### NXHX-F01 — Initialize repository, Beads, Codex integration, and AGENTS rules

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E0`
- **Depends on:** none
- **Labels:** `beads`, `agents`
- **PRD sections:** 25

Create the root package/workspace skeleton. Initialize Beads and Codex integration. Add project instructions inherited from genes-ts, PhoenixHx, and RailsHx: Beads-only tracking, framework-first output, no Dynamic/untyped, read-only sibling references, generic compiler fixes, mandatory evidence, and synchronization behavior governed by the active Beads agent context profile. The default conservative profile must not commit or push without explicit authority.

**Acceptance criteria**

- bd init succeeds with the selected prefix.
- bd setup codex --check succeeds.
- AGENTS.md states the non-negotiable architecture and quality rules and defers current Beads workflow syntax to bd prime.
- The default agent profile does not authorize commits, Git pushes, or bd dolt push without explicit user/repository authority.
- No Markdown TODO list is used as a tracker.
- Root build/test commands exist, even if initially minimal.
- The seed helper imports the complete graph under the installed Beads version and postflight graph/lint checks pass.

### NXHX-F07 — Establish public-repository secret, path-leak, formatting, and hook baseline

- **Type:** `task`
- **Priority:** P0
- **Parent:** `NXHX-E0`
- **Depends on:** `NXHX-F01`
- **Labels:** `security`, `governance`, `hooks`, `foundation`
- **PRD sections:** 17, 19, 21, 25

Install the fail-closed repository governance baseline before implementation work: tracked Beads-compatible Git hooks, exact Haxe formatting, staged and full-history secret scanning, decoded Beads/Dolt scanning, machine-local path rejection, credential ignores, and CI parity. This protects both Git refs and the separate `refs/dolt/data` issue history from accidental publication of secrets or workstation-specific data.

**Acceptance criteria**

- A tracked pre-commit hook composes with Beads, formats and re-stages only repository-owned staged `.hx` files with formatter 1.18.0, rejects whitespace errors, and rejects machine-local paths.
- Pre-commit runs Gitleaks 8.30.0 against staged content; pre-push and the public preflight scan every reachable Git revision with redaction.
- Current and historical decoded Beads records are scanned before any `bd dolt push` through a safe wrapper.
- CI repeats the full-history secret scan with a checksum-verified Gitleaks binary and checks Haxe formatting with full-SHA-pinned actions.
- `.gitignore` excludes environment files, credentials, private keys, local agent settings, package/build output, and framework caches without hiding reviewed examples.
- Hook installation is idempotent, activates `.beads/hooks`, preserves Beads-managed sections, and documents exact prerequisites.
- Security-tooling self-checks and the public preflight pass from this repository state.

### NXHX-F02 — Add machine-readable support matrix and sibling repository discovery

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E0`
- **Depends on:** `NXHX-F07`
- **Labels:** `compatibility`, `tooling`
- **PRD sections:** 2.2, 9.5, 21.2

Add support_matrix.json and deterministic discovery for genes-ts and the read-only ../nextjs checkout. Record exact versions/commits and distinguish required stable-package evidence from optional local-upstream evidence.

**Acceptance criteria**

- support_matrix.json validates against a documented schema.
- Next stable, Node floor/current lane, React, TypeScript, Haxe, and genes-ts identities are recorded.
- Missing ../nextjs produces an actionable non-fatal diagnostic outside the upstream lane.
- No runtime/library code hardcodes a sibling path.

### NXHX-F03 — Write ADR: adapter-first App Router integration

- **Type:** `decision`
- **Priority:** P1
- **Parent:** `NXHX-E0`
- **Depends on:** `NXHX-F07`
- **Labels:** `decision`, `adr`, `architecture`
- **PRD sections:** 9

#### Decision

Select and document the canonical App Router integration strategy. The current recommendation is adapter-first generation with explicit criteria for any future direct genes-ts emission.

#### Rationale

Next requires exact filenames, default and named exports, and directive placement that a file-per-Haxe-module compiler cannot reliably express without a narrow adapter layer.

#### Alternatives considered

- Generic direct compiler emission for directives and export shapes.
- A custom runtime or router that replaces Next conventions.
- Hand-maintained TypeScript adapters without generated ownership.

**Acceptance criteria**

- ADR compares adapter-first, direct compiler emission, and custom runtime alternatives.
- ADR selects adapter-first and explains directives/default exports/filesystem constraints.
- ADR defines files NextJsHx never owns.
- Decision is linked from the architecture docs and relevant Beads.

### NXHX-F04 — Write ADR: public namespace and App Router authoring syntax

- **Type:** `decision`
- **Priority:** P1
- **Parent:** `NXHX-E0`
- **Depends on:** `NXHX-F07`
- **Labels:** `decision`, `adr`, `api-design`
- **PRD sections:** 8.3, 10, 11, 12

#### Decision

Select and document the public namespace split and initial App Router authoring syntax for pages, layouts, route handlers, client components, and Server Functions.

#### Rationale

The API must preserve a faithful raw Next.js escape hatch while adding typed Haxe ergonomics without creating a duplicated central route registry.

#### Alternatives considered

- Raw externs only, with no semantic layer.
- Semantic wrappers only, hiding the public Next.js surface.
- A central manually maintained route declaration list.

**Acceptance criteria**

- ADR includes representative Haxe and generated TS examples.
- The design preserves a faithful raw escape hatch.
- The design avoids a central manually duplicated route list.
- Unsupported future syntax is explicitly deferred.

### NXHX-F05 — Build minimal genes-ts TSX inside a real Next App Router fixture

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E0`
- **Depends on:** `NXHX-F02`, `NXHX-F03`
- **Labels:** `vertical-slice`, `next-build`
- **PRD sections:** 9.1, 22

Create a tiny Next app with a hand-written page adapter importing one genes-ts-generated TSX component. This is the first integration proof and compiler-gap discovery fixture.

**Acceptance criteria**

- Haxe 4.3.7 compiles the component through pinned genes-ts.
- Generated code uses split ESM TS/TSX and bundler-compatible imports.
- next typegen and next build pass on the pinned stable Next release.
- Rendered output is verified by a focused runtime or browser smoke test.
- No Dynamic/untyped is used in app/test code.

### NXHX-F06 — Establish baseline CI, snapshots, negative-test harness, and package-shape harness

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E0`
- **Depends on:** `NXHX-F05`
- **Labels:** `ci`, `testing`
- **PRD sections:** 17

Create the reusable test infrastructure before broad feature work: Haxe positives, expected failures with diagnostic codes, generated snapshots, strict TypeScript, Next build, and packed consumer fixtures.

**Acceptance criteria**

- CI runs from a clean checkout.
- Snapshot update and verification commands are documented.
- Negative fixtures assert diagnostic code and source location.
- TypeScript build errors are not disabled.
- Package-shape harness can install local packed artifacts.

### NXHX-E1 — Generic genes-ts capabilities required by NextJsHx

- **Type:** `epic`
- **Priority:** P1
- **Parent:** `NXHX-ROOT`
- **Depends on:** none
- **Labels:** `genes-ts`, `compiler`
- **PRD sections:** 9.4, 25

Reduce downstream compiler gaps to generic genes-ts features and land them with full two-mode CI. This epic contains no Next-specific compiler behavior.

**Acceptance criteria**

- Every landed change has a reduced generic fixture.
- Full genes-ts TypeScript and classic-JS CI is green.
- NextJsHx records the exact compatible genes-ts identity.

### NXHX-G01 — Inventory and reduce genes-ts gaps exposed by the minimal Next fixture

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E1`
- **Depends on:** `NXHX-F05`
- **Labels:** `compiler-gap`, `research`
- **PRD sections:** 9.4

Document concrete gaps for directives, export shape, TSX component imports, DCE visibility, import types, or helper types. Create minimal non-Next repros in the genes-ts style.

**Acceptance criteria**

- Each gap has expected Haxe input and TypeScript/JS output.
- Framework-specific paths/names are removed from repros.
- Workarounds and risks are documented.
- Follow-up compiler Beads are linked.

### NXHX-G02 — Add generic deterministic module directive prologues to genes-ts

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E1`
- **Depends on:** `NXHX-G01`
- **Labels:** `genes-ts`, `directives`
- **PRD sections:** 9.4, 12

Implement a generic metadata/API for module directive prologues such as use client/use server/use cache without embedding Next knowledge. Directives must print before imports and remain semantically valid in classic JS output.

**Acceptance criteria**

- Multiple directives have deterministic order and deduplication.
- TypeScript snapshot proves placement before imports.
- Classic JS snapshot/runtime proves equivalent valid directive prologue behavior.
- Invalid/non-literal directives fail with a focused diagnostic.
- Full genes-ts CI passes.

### NXHX-G03 — Evaluate and implement generic named/default export support where justified

- **Type:** `feature`
- **Priority:** P2
- **Parent:** `NXHX-E1`
- **Depends on:** `NXHX-G01`
- **Labels:** `genes-ts`, `exports`
- **PRD sections:** 9.4

Decide whether generic export metadata materially improves NextJsHx and other TS consumers. If accepted, implement top-level named/default export support without weakening class/module semantics.

**Acceptance criteria**

- Decision documents adapter-only versus compiler export support.
- Accepted implementation has generic fixtures for default and named exports.
- DCE, cycles, declaration output, and both genes output modes are tested.
- Rejected scope records why adapters remain canonical.

### NXHX-G04 — Harden TS-authored imports of Haxe output and DCE-safe component handles

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E1`
- **Depends on:** `NXHX-G01`
- **Labels:** `genes-ts`, `interop`, `dce`
- **PRD sections:** 12.2, 16.2

Provide a generic, documented way for TS-authored adapters to import Haxe-emitted values without DCE removing them, and prove typed TSX component imports do not introduce broad casts.

**Acceptance criteria**

- A generic fixture reproduces TS-only import visibility.
- The supported keep/export pattern is documented.
- Component type remains precise under strict TSX checking.
- Classic JS behavior is unchanged or explicitly guarded.
- Full genes-ts CI passes for compiler changes.

### NXHX-G05 — Publish/record a green genes-ts compatibility checkpoint

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E1`
- **Depends on:** `NXHX-G02`, `NXHX-G04`
- **Labels:** `genes-ts`, `compatibility`
- **PRD sections:** 2.2, 23

Run the complete compiler gate, record the tested commit/version, and unblock NextJsHx work that depends on the new generic capabilities.

**Acceptance criteria**

- All mandatory genes-ts CI lanes pass.
- support_matrix.json is updated with exact identity.
- A short compatibility note lists required features and deferred compiler work.
- No NextJsHx code depends on an unpushed compiler change.

### NXHX-E2 — Public Next.js bindings and faithful raw surface

- **Type:** `epic`
- **Priority:** P1
- **Parent:** `NXHX-ROOT`
- **Depends on:** none
- **Labels:** `bindings`, `externs`
- **PRD sections:** 10

Create a curated, drift-detectable Haxe binding layer for supported public next/* entrypoints.

**Acceptance criteria**

- P0 allowlisted modules have typed positive fixtures and strict TS snapshots.
- Surface drift is machine-detected.
- App-facing APIs do not depend on unsupported next/dist runtime imports.

### NXHX-B01 — Define public-entrypoint allowlist and normalized surface manifest

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E2`
- **Depends on:** `NXHX-F02`, `NXHX-F06`
- **Labels:** `bindings`, `surface`
- **PRD sections:** 10.1, 10.3

Create config/next-public-entrypoints.json and the normalized export/signature manifest format. Inventory the pinned Next package rather than exposing all shipped d.ts files.

**Acceptance criteria**

- Each entry records module, exports, kind, stability, signature hash, and fixture.
- P0/P1/P2 support classification matches the PRD.
- Internal supporting declarations are explicitly separated from public promises.
- Manifest generation is deterministic.

### NXHX-B02 — Implement declaration ingestion, override, and drift-report pipeline

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E2`
- **Depends on:** `NXHX-B01`, `NXHX-F06`
- **Labels:** `dts2hx`, `bindings`, `drift`
- **PRD sections:** 10.2, 10.5

Use dts2hx or a focused parser to ingest allowlisted declarations, apply reviewed overrides, and emit curated externs plus a human-readable drift report.

**Acceptance criteria**

- Exact installed Next version is recorded in outputs.
- Unsupported TypeScript constructs fail closed.
- Overrides are small, documented, and snapshot-tested.
- Repeated generation is byte-stable.
- Breaking drift fails CI with an actionable report.

### NXHX-B03 — Bind core Next types and next/navigation

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E2`
- **Depends on:** `NXHX-B02`
- **Labels:** `navigation`, `types`
- **PRD sections:** 10.1, 13.1

Implement faithful raw types for the root Next type surface needed by App Router plus navigation hooks and control-flow interrupts.

**Acceptance criteria**

- useRouter/usePathname/useParams/useSearchParams and selected-segment hooks are typed.
- redirect/permanentRedirect/notFound/forbidden/unauthorized preserve non-returning behavior as closely as Haxe/genes permit.
- No Dynamic/any is introduced to model overloads.
- Strict TS fixtures call every supported export.

### NXHX-B04 — Bind Link, Image, Form, and core React component props

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E2`
- **Depends on:** `NXHX-B02`
- **Labels:** `components`, `tsx`
- **PRD sections:** 10.1, 13.2

Create faithful default-import component externs and typed prop surfaces for P0 Next components, integrated with genes React TSX/HXX.

**Acceptance criteria**

- Default imports emit correctly.
- Required/optional props and route href types are preserved where expressible.
- Positive TSX fixtures and expected prop errors are covered.
- No wrapper runtime is introduced.

### NXHX-B05 — Bind next/headers, next/cache, and next/server P0 surface

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E2`
- **Depends on:** `NXHX-B02`
- **Labels:** `server`, `headers`, `cache`
- **PRD sections:** 10.1, 13.3

Model async cookies/headers/draft mode, revalidation/cache APIs, NextRequest/NextResponse, user-agent helpers, after, and connection for the supported version.

**Acceptance criteria**

- Async return types match the pinned declarations.
- Cookie mutation methods are typed separately from read use where practical.
- Cache profile literals are modeled without stringly app APIs.
- NextRequest/NextResponse fixtures pass in a route-handler context.

### NXHX-B06 — Add public-surface drift CI against installed and ../nextjs declarations

- **Type:** `task`
- **Priority:** P2
- **Parent:** `NXHX-E2`
- **Depends on:** `NXHX-B02`, `NXHX-B03`, `NXHX-B04`, `NXHX-B05`
- **Labels:** `upstream`, `compatibility`
- **PRD sections:** 10.5, 17.4

Compare normalized public surfaces against the stable npm package on every PR and the configured sibling checkout in an upstream lane.

**Acceptance criteria**

- Stable drift is blocking.
- Local-upstream/canary drift produces a classified report.
- Equivalent internal declaration moves do not create false public breaks.
- Reports identify the owning binding and fixture.

### NXHX-B07 — Document raw bindings, semantic façades, and escape-hatch policy

- **Type:** `task`
- **Priority:** P2
- **Parent:** `NXHX-E2`
- **Depends on:** `NXHX-B03`, `NXHX-B04`, `NXHX-B05`
- **Labels:** `docs`, `interop`
- **PRD sections:** 10, 13.5, 20

Write the binding policy and practical guide for direct nextjs.raw use, semantic wrappers, third-party Imports, and unsupported APIs.

**Acceptance criteria**

- Every P0 module has a usage example.
- Stability and unsupported surface are explicit.
- No docs recommend next/dist runtime imports or Dynamic.
- Mixed Haxe/TS examples link to executable fixtures.

### NXHX-E3 — App Router declarations, route model, and generated adapters

- **Type:** `epic`
- **Priority:** P1
- **Parent:** `NXHX-ROOT`
- **Depends on:** none
- **Labels:** `app-router`, `codegen`
- **PRD sections:** 11

Implement Haxe-owned App Router modules and deterministic Next-native convention adapters.

**Acceptance criteria**

- Core special files build on pinned Next stable.
- Route contracts are checked in Haxe and again by Next typegen/TypeScript.
- Generated artifacts are short, deterministic, and framework-native.

### NXHX-A01 — Define deterministic adapter-plan schema and macro registry

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-F03`, `NXHX-F04`
- **Labels:** `codegen`, `schema`
- **PRD sections:** 9.1, 18.2

Create the compile-time data model that records source type/field positions, adapter kind, segment path, exports, directives, config, and target path before any file write.

**Acceptance criteria**

- Plan schema is versioned and deterministic.
- Duplicate targets are rejected during plan validation.
- Every intent retains a Haxe source position for diagnostics.
- Plan can be emitted as JSON for tests/tooling without executing app code.

### NXHX-A02 — Implement page and layout build macros with signature validation

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-A01`, `NXHX-B03`
- **Labels:** `page`, `layout`, `macros`
- **PRD sections:** 11.2, 11.6

Implement the locked page/layout annotation and validate render methods, params, children, async return types, metadata/config declarations, and root layout constraints.

**Acceptance criteria**

- Positive page/root-layout/nested-layout fixtures compile.
- Missing/wrong render signatures produce stable diagnostics.
- No business logic is copied into adapters.
- Generated plan contains exact source and target data.

### NXHX-A03 — Render page/layout adapters and strict Next type signatures

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-A02`, `NXHX-F03`
- **Labels:** `adapters`, `tsx`
- **PRD sections:** 9.3, 11.2

Generate exact page.tsx/layout.tsx files that import genes output and expose default functions typed with Next route-aware helpers where available.

**Acceptance criteria**

- Adapters use correct relative imports under app or src/app.
- Default exports and named config exports match Next.
- Snapshots are formatted and deterministic.
- next typegen, tsc, and next build pass.

### NXHX-A04 — Implement route-segment parser and dynamic param validator

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-A01`
- **Labels:** `routing`, `params`
- **PRD sections:** 11.3

Parse static, dynamic, catch-all, optional catch-all, and supported route-group syntax; derive public URL patterns and validate Haxe param typedefs/codecs.

**Acceptance criteria**

- [id], [...slug], and [[...slug]] positive fixtures pass.
- Missing/extra/wrong param types fail with source-positioned diagnostics.
- Traversal/reserved/malformed paths fail before generation.
- Unsupported slots/interception syntax is rejected explicitly.

### NXHX-A05 — Generate per-route typed href/route refs without server implementation imports

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-A04`
- **Labels:** `routing`, `ergonomics`
- **PRD sections:** 11.4, 13.1

Give each Haxe-owned route a typed URL builder/ref, ideally macro/inline, that encodes params and cannot pull page implementation code into the wrong module graph.

**Acceptance criteria**

- Missing/extra params fail in Haxe.
- Dynamic values are URL-encoded.
- Static route refs emit no unnecessary runtime dependency.
- Server and client fixtures use the same typed ref.
- Next typed Route parity check accepts every emitted href.

### NXHX-A06 — Support loading, error, and not-found special files

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-A03`
- **Labels:** `special-files`, `error-boundary`
- **PRD sections:** 11.7

Add macros and adapters for loading, error, and not-found modules, including automatic client boundary for error files and precise error/reset props.

**Acceptance criteria**

- Exact filenames/default exports are generated.
- error adapter begins with use client.
- Wrong error/reset signatures fail in Haxe.
- Runtime fixture proves loading, not-found, and reset behavior.

### NXHX-A07 — Support metadata, generateStaticParams, and segment config

- **Type:** `feature`
- **Priority:** P2
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-A02`, `NXHX-A04`, `NXHX-B03`
- **Labels:** `metadata`, `segment-config`
- **PRD sections:** 11.8, 11.9

Emit supported static/named exports for metadata, generated metadata, static params, and literal-preserving segment config.

**Acceptance criteria**

- Static and generated metadata fixtures pass.
- Static params return matches route params.
- Invalid config values fail before Next build.
- Next plugin/typecheck remains a second verifier.

### NXHX-A08 — Implement Route Handler declarations and named HTTP method adapters

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-A01`, `NXHX-A04`, `NXHX-B05`
- **Labels:** `route-handler`, `api`
- **PRD sections:** 11.10

Generate route.ts named exports for typed Haxe handler methods and validate request/context/response contracts.

**Acceptance criteria**

- GET/POST/DELETE fixture passes.
- Duplicate/unsupported methods fail.
- Context params are Promise-shaped and route-validated.
- Incompatible return types fail without any cast.
- Next build/runtime consumes the handlers.

### NXHX-A09 — Add route-aware TypeScript parity and native route inventory

- **Type:** `task`
- **Priority:** P2
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-A03`, `NXHX-A05`
- **Labels:** `typed-routes`, `interop`
- **PRD sections:** 11.4, 16.3

Use next typegen/typedRoutes to verify generated Haxe route refs and inventory supported native-owned routes without claiming their implementation.

**Acceptance criteria**

- Every Haxe route literal is accepted by Next Route typing.
- Native routes are listed with ownership status.
- Unsupported route syntax fails closed.
- No .next type file is edited or treated as a stable public format beyond the tested parity seam.

### NXHX-A10 — Implement proxy.ts support with typed matcher/config

- **Type:** `feature`
- **Priority:** P2
- **Parent:** `NXHX-E3`
- **Depends on:** `NXHX-A01`, `NXHX-B05`, `NXHX-T02`
- **Labels:** `proxy`, `p1`
- **PRD sections:** 11.11

Add root-level proxy generation after core app routing and ownership are stable.

**Acceptance criteria**

- One function and optional config are generated at the correct root.
- Matcher literals are typed and snapshot-tested.
- Existing native proxy causes a collision.
- Runtime behavior is proven by a focused fixture.

### NXHX-E4 — Server/client boundaries, Server Functions, and cache semantics

- **Type:** `epic`
- **Priority:** P1
- **Parent:** `NXHX-ROOT`
- **Depends on:** `NXHX-E3`
- **Labels:** `boundaries`, `full-stack`
- **PRD sections:** 12

Model Next/React module graph boundaries and safe cross-boundary values while keeping native runtime behavior.

**Acceptance criteria**

- Interactive Haxe components and Server Functions work in the real app.
- Known boundary violations fail in Haxe and/or the mandatory Next build lane.
- No custom RPC/runtime envelope is introduced.

### NXHX-C01 — Define boundary classification metadata and import-graph policy

- **Type:** `decision`
- **Priority:** P1
- **Parent:** `NXHX-E4`
- **Depends on:** `NXHX-F04`, `NXHX-G01`
- **Labels:** `decision`, `boundary`, `adr`
- **PRD sections:** 12.1

#### Decision

Select and document the server-default, client, Server Function, cache, shared, server-only, and client-only categories plus the enforcement split between Haxe macros, generated adapters, and Next build validation.

#### Rationale

The module graph is a security and correctness boundary. The policy must prevent server implementation imports and secrets from entering client output while preserving ordinary Next and React semantics.

#### Alternatives considered

- Rely only on Next build diagnostics.
- Enforce every graph rule exclusively in Haxe macros.
- Introduce a custom runtime boundary or RPC envelope.

**Acceptance criteria**

- ADR covers direct Haxe imports, adapter refs, DCE, and generic directives.
- Policy identifies checks owned by Haxe versus Next TypeScript/build.
- One-module-per-boundary constraints are explicit.

### NXHX-C02 — Implement client component adapters and typed component refs

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E4`
- **Depends on:** `NXHX-C01`, `NXHX-G04`, `NXHX-B04`, `NXHX-T02`
- **Labels:** `client-component`, `tsx`
- **PRD sections:** 12.2

Generate use-client boundary modules and a precise Haxe authoring/ref API that server Haxe modules can render without importing raw client implementation code.

**Acceptance criteria**

- Adapter directive precedes imports.
- Props are precise in Haxe and generated TSX.
- Implementation remains reachable under DCE.
- Raw unsafe import gets an actionable diagnostic.
- Hydration/interactivity passes in Next.

### NXHX-C03 — Implement conservative React boundary serializability checker

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E4`
- **Depends on:** `NXHX-C01`
- **Labels:** `serialization`, `type-safety`
- **PRD sections:** 12.3

Validate props and Server Function values against an evidence-backed conservative allowlist, with explicit extensions for tested built-ins and action refs.

**Acceptance criteria**

- Allowed recursive value fixtures pass.
- Functions/class instances/Unknown/cycles fail.
- Diagnostics identify the offending field/type path.
- Every newly allowed built-in has a real Next positive fixture.
- Escape hatch is narrow, visible, and separately tested if provided.

### NXHX-C04 — Implement Server Function/action adapters and typed refs

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E4`
- **Depends on:** `NXHX-C01`, `NXHX-C03`, `NXHX-B05`
- **Labels:** `server-functions`, `actions`
- **PRD sections:** 12.4

Generate use-server modules that wrap async Haxe functions and expose typed refs to client/server consumers without importing raw server implementations into the client graph.

**Acceptance criteria**

- Non-async exports fail.
- Argument/return serializability is checked.
- FormData action fixture works.
- Auth/authorization responsibility is documented in generated example code/docs.
- No custom RPC envelope is added.

### NXHX-C05 — Add server-only/client-only enforcement and environment containment

- **Type:** `feature`
- **Priority:** P0
- **Parent:** `NXHX-E4`
- **Depends on:** `NXHX-C01`, `NXHX-G02`
- **Labels:** `security`, `module-graph`
- **PRD sections:** 12.6, 19.3

Integrate ordinary server-only/client-only side-effect contracts and Haxe diagnostics for known-invalid imports/environment access.

**Acceptance criteria**

- Client importing headers/server-only fails.
- Server-only env values are absent from client bundle evidence.
- Side-effect imports emit deterministically.
- Next build remains blocking and catches graph violations.

### NXHX-C06 — Implement cache directive adapters and typed revalidation helpers

- **Type:** `feature`
- **Priority:** P2
- **Parent:** `NXHX-E4`
- **Depends on:** `NXHX-C01`, `NXHX-B05`, `NXHX-G02`
- **Labels:** `cache`, `directives`
- **PRD sections:** 12.5

Support stable use-cache shapes and direct cacheLife/cacheTag/revalidation calls with literal-preserving output and version capability gates.

**Acceptance criteria**

- Module/function directive placement is correct.
- Invalid request API use in ordinary cached scope has a focused negative fixture where statically detectable.
- Stable cache behavior is proven at runtime.
- Private/remote cache variants remain explicit experimental capabilities.

### NXHX-C07 — Implement typed request/form/JSON codec helpers

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E4`
- **Depends on:** `NXHX-B05`, `NXHX-A08`
- **Labels:** `codec`, `validation`
- **PRD sections:** 13.4, 19.2

Provide a small codec boundary for request JSON, FormData, query values, and typed responses without turning internal values into needless wire schemas.

**Acceptance criteria**

- Unknown external value is immediately decoded.
- Malformed JSON/form data produces typed errors.
- Response encoding is precise and deterministic.
- No app-facing Dynamic/any/opaque field access is used.
- Helpers are reusable by the todo app and bridge research.

### NXHX-E5 — CLI, safe generated ownership, watch loop, and gradual adoption

- **Type:** `epic`
- **Priority:** P1
- **Parent:** `NXHX-ROOT`
- **Depends on:** none
- **Labels:** `tooling`, `ownership`, `adoption`
- **PRD sections:** 14, 15, 16

Build the host-native Node tooling and fail-closed file ownership required for daily use in real Next apps.

**Acceptance criteria**

- All writes are manifest-owned, staged, contained, and recoverable.
- CLI supports generate/dev/build/typecheck/routes/doctor/clean.
- Mixed native/Haxe adoption is proven without overwrites.

### NXHX-T01 — Implement versioned config and Next project/workspace discovery

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E5`
- **Depends on:** `NXHX-F02`, `NXHX-F03`
- **Labels:** `config`, `discovery`
- **PRD sections:** 15.1

Parse nextjshx.config.json, detect workspace/package manager/app root, and validate version/package paths without executing arbitrary config code.

**Acceptance criteria**

- Unknown config keys fail by default.
- app and src/app are detected.
- Monorepo package root is distinguished from workspace root.
- Config schema/version diagnostics are stable.

### NXHX-T02 — Implement manifest model, path containment, checksum preflight, and collision detection

- **Type:** `feature`
- **Priority:** P0
- **Parent:** `NXHX-E5`
- **Depends on:** `NXHX-A01`, `NXHX-T01`
- **Labels:** `ownership`, `security`
- **PRD sections:** 14.1, 14.2, 14.3

Create .nextjshx/manifest.json and the pure preflight layer before publication.

**Acceptance criteria**

- Absolute/traversal/duplicate/reserved paths fail.
- Symlink files and escaping parents fail.
- Existing unowned targets fail.
- Modified owned outputs fail before any mutation.
- Unknown manifest version fails closed.

### NXHX-T03 — Implement staged formatting, atomic publication, journal, and recovery

- **Type:** `feature`
- **Priority:** P0
- **Parent:** `NXHX-E5`
- **Depends on:** `NXHX-T02`
- **Labels:** `transaction`, `recovery`
- **PRD sections:** 14.2, 14.5

Generate the complete next tree in staging, format/parse it, publish changed files, remove stale owned files, replace manifest last, and recover interrupted runs by exact hashes.

**Acceptance criteria**

- Formatter errors leave live app untouched.
- Unchanged files are not rewritten.
- Crash simulations recover or stop safely on unexpected bytes.
- Post-publication typecheck failure restores prior adapters.
- Concurrent publishers cannot race.

### NXHX-T04 — Implement safe clean, repair, and ownership-transfer workflows

- **Type:** `feature`
- **Priority:** P2
- **Parent:** `NXHX-E5`
- **Depends on:** `NXHX-T03`
- **Labels:** `clean`, `repair`
- **PRD sections:** 14.4, 14.6, 16.5

Delete only verified owned files and provide explicit repair/adopt/release flows for drift or deliberate ownership changes.

**Acceptance criteria**

- Clean preflights all entries before deleting one.
- Missing manifest owns nothing.
- Modified output blocks clean.
- Ownership transfer is explicit and documented.
- No global force bypasses containment/symlink checks.

### NXHX-T05 — Implement generate, typecheck, routes, doctor, and JSON output

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E5`
- **Depends on:** `NXHX-T03`, `NXHX-T01`
- **Labels:** `cli`, `diagnostics`
- **PRD sections:** 15.3, 15.6, 15.7, 15.8

Create core CLI commands with stable diagnostic codes and machine-readable output for agents/CI.

**Acceptance criteria**

- generate runs Haxe, publishes only on success, and reports changed/unchanged/removed.
- typecheck runs Haxe + Next typegen + strict TS.
- routes reports path/public pattern/params/ownership/parity.
- doctor checks versions, paths, manifest, transactions, and unsupported features.
- All commands support --json where useful.

### NXHX-T06 — Implement idempotent nextjshx init for new and existing apps

- **Type:** `feature`
- **Priority:** P2
- **Parent:** `NXHX-E5`
- **Depends on:** `NXHX-T01`, `NXHX-T02`
- **Labels:** `init`, `adoption`
- **PRD sections:** 15.2

Create config, Haxe roots, hxml, scripts, and optional typedRoutes patch only when safe and explicit.

**Acceptance criteria**

- Repeated init is byte-stable.
- Native route/config collisions are preserved and reported.
- Package scripts are patched idempotently with a visible diff.
- No lockfile is modified unexpectedly.
- New-app and existing-app snapshots pass.

### NXHX-T07 — Implement serialized Haxe watch plus next dev orchestration

- **Type:** `feature`
- **Priority:** P2
- **Parent:** `NXHX-E5`
- **Depends on:** `NXHX-T05`
- **Labels:** `watch`, `dev`
- **PRD sections:** 15.4

Provide the daily dev loop while leaving HMR and runtime ownership to Next.

**Acceptance criteria**

- Only successful Haxe compiles publish adapters.
- Last good output survives a compile error.
- Rapid edits do not create overlapping transactions.
- Signals terminate child processes cleanly.
- Next CLI arguments pass through.

### NXHX-T08 — Implement production build orchestration and stale-output verification

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E5`
- **Depends on:** `NXHX-T05`
- **Labels:** `build`, `ci`
- **PRD sections:** 15.5

Run doctor, clean generation, publication, next typegen, strict TS, next build, and manifest verification in the required order.

**Acceptance criteria**

- Build fails on Haxe, ownership, TS, or Next errors.
- Next build type errors remain enabled.
- Ordinary Next flags pass through.
- A clean consumer fixture uses this command successfully.

### NXHX-T09 — Prove mixed Haxe/TypeScript ownership and interop in both directions

- **Type:** `feature`
- **Priority:** P2
- **Parent:** `NXHX-E5`
- **Depends on:** `NXHX-T06`, `NXHX-T05`, `NXHX-G04`
- **Labels:** `gradual-adoption`, `interop`
- **PRD sections:** 16

Create a fixture with native routes/components beside Haxe-owned routes, Haxe importing TS, and TS importing Haxe output.

**Acceptance criteria**

- Native files stay unowned and unchanged.
- Haxe/TS imports typecheck and run.
- TS-only imports preserve Haxe values under DCE.
- Native route inventory/ref generation works for supported shapes.
- Unsupported native route shapes fail closed.

### NXHX-E6 — Examples, production evidence, compatibility, docs, and release

- **Type:** `epic`
- **Priority:** P1
- **Parent:** `NXHX-ROOT`
- **Depends on:** `NXHX-E2`, `NXHX-E3`, `NXHX-E4`, `NXHX-E5`
- **Labels:** `evidence`, `release`
- **PRD sections:** 17, 20, 21

Turn individual capabilities into maintained applications, CI evidence, documentation, compatibility policy, and verified release artifacts.

**Acceptance criteria**

- Hello, mixed-adoption, and todo apps are green.
- Playwright and production build pass.
- Support matrix, docs, and artifacts are verified.

### NXHX-R01 — Promote the minimal proof into examples/hello-next

- **Type:** `task`
- **Priority:** P2
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-A03`, `NXHX-T05`
- **Labels:** `example`, `hello`
- **PRD sections:** 22

Create a polished minimal App Router example using the public NextJsHx workflow rather than hand-maintained integration glue.

**Acceptance criteria**

- Uses nextjshx generate/dev/build.
- Root layout/page are Haxe-owned and manifest-owned.
- README starts from clean prerequisites.
- Production build and snapshot pass.

### NXHX-R02 — Create todoapp domain, test persistence, root layout, and server list/detail routes

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-A05`, `NXHX-A06`, `NXHX-A07`, `NXHX-T08`
- **Labels:** `todoapp`, `server-components`
- **PRD sections:** 17.3

Establish the production evidence app with deterministic test data, server-rendered list/detail pages, metadata, loading, not-found, and typed navigation.

**Acceptance criteria**

- List/detail flows build and run.
- Dynamic route params and href refs are used.
- Persistence is isolated and deterministic for CI.
- No ORM complexity obscures framework tests.

### NXHX-R03 — Add Haxe client components and Server Function mutations to todoapp

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-R02`, `NXHX-C02`, `NXHX-C04`
- **Labels:** `todoapp`, `actions`, `client`
- **PRD sections:** 17.3

Implement create/toggle/delete and validation UI using Haxe client boundaries, next/form, and Haxe Server Functions.

**Acceptance criteria**

- Hydration and event handling work.
- Mutation arguments/results pass serializability checks.
- Validation errors are typed.
- Sensitive mutation examples include auth/authorization guidance.

### NXHX-R04 — Add typed Route Handler API, request APIs, and cache/revalidation to todoapp

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-R02`, `NXHX-A08`, `NXHX-C06`, `NXHX-C07`
- **Labels:** `todoapp`, `route-handler`, `cache`
- **PRD sections:** 17.3

Exercise JSON API decoding/encoding, cookies/headers, cache tags/lifetime, and revalidation in realistic seams.

**Acceptance criteria**

- Malformed payload returns typed error.
- Cookie/header reads occur only in valid contexts.
- Cache invalidation changes visible UI as expected.
- Runtime tests demonstrate behavior, not only snapshots.

### NXHX-R05 — Add mixed TS/Haxe interop and native-owned route to todoapp

- **Type:** `feature`
- **Priority:** P2
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-T09`, `NXHX-R02`
- **Labels:** `todoapp`, `interop`
- **PRD sections:** 17.3, 16

Prove one TS component imported by Haxe, one Haxe component imported by TS, and one native route colocated with Haxe-owned routes.

**Acceptance criteria**

- All imports are precisely typed.
- Native route remains unowned.
- No manual generated edit is required.
- Production build and runtime paths pass.

### NXHX-R06 — Build Playwright E2E suite for navigation, mutation, hydration, and failures

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-R03`, `NXHX-R04`
- **Labels:** `playwright`, `e2e`
- **PRD sections:** 17.1, 17.3

Cover the user-visible production evidence, including route navigation, action mutations, loading/not-found/error reset, API failure, and no hydration errors.

**Acceptance criteria**

- Tests run against a production server in CI.
- Database/state setup is isolated per run.
- Browser console/hydration errors fail tests.
- Retries do not mask deterministic failures.

### NXHX-R07 — Implement full CI matrix and upstream Next compatibility report

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-B06`, `NXHX-R06`, `NXHX-T08`
- **Labels:** `ci`, `upstream`, `matrix`
- **PRD sections:** 17.4

Run declared Node/Next/bundler lanes and generate stable versus sibling/canary surface/build reports.

**Acceptance criteria**

- Minimum Node and current pinned LTS are green.
- Stable Next lane is blocking.
- Turbopack/default build is blocking.
- Webpack lane status matches support_matrix.
- Sibling/canary drift opens or links actionable Beads.

### NXHX-R08 — Complete public documentation and diagnostic catalog

- **Type:** `task`
- **Priority:** P2
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-B07`, `NXHX-T05`, `NXHX-R04`
- **Labels:** `docs`, `diagnostics`
- **PRD sections:** 18, 20

Write all required user/maintainer guides and document every stable diagnostic family and recovery flow.

**Acceptance criteria**

- Getting started works from clean checkout.
- App Router, boundaries, actions, handlers, cache, ownership, adoption, and escape hatches are covered.
- Every public nontrivial module has useful Haxe docs.
- Docs examples are executable or snapshot-tested.

### NXHX-R09 — Run type-safety, generated-output, security, and production-readiness audit

- **Type:** `task`
- **Priority:** P1
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-R07`, `NXHX-R08`
- **Labels:** `audit`, `security`, `quality`
- **PRD sections:** 17, 19, 23

Audit the repository against the PRD and reference-project quality rules before release candidate.

**Acceptance criteria**

- No unexplained Dynamic/untyped/any/broad unknown remains.
- Generated adapters are readable and minimal.
- Ownership adversarial tests cover traversal/symlink/drift/crash.
- Server/client secret and input-validation posture is documented and tested.
- Open gaps are Beads with priority and release impact.

### NXHX-R10 — Package Haxelib and npm CLI artifacts and verify clean consumer installation

- **Type:** `feature`
- **Priority:** P1
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-R09`
- **Labels:** `packaging`, `release`
- **PRD sections:** 21.4

Create deterministic release artifacts from the tested tree and verify them in clean consumers.

**Acceptance criteria**

- Packed Haxelib and npm artifacts contain only intended files.
- Version/support identity is embedded and consistent.
- Clean consumer installs without sibling repos.
- Checksums are produced.
- Release notes include migrations and known exclusions.

### NXHX-R11 — Record performance baseline and runtime-overhead report

- **Type:** `task`
- **Priority:** P2
- **Parent:** `NXHX-E6`
- **Depends on:** `NXHX-R06`, `NXHX-T07`
- **Labels:** `performance`
- **PRD sections:** 17.5

Measure cold/warm generation, files rewritten, dev startup delta, and bundle/runtime helper footprint before setting future budgets.

**Acceptance criteria**

- Measurements are reproducible and hardware/context are recorded.
- Single-module edit rewrites only required outputs.
- Runtime overhead sources are itemized.
- Regressions become Beads rather than untracked notes.

### NXHX-E7 — Low-priority ContractHx interoperability research

- **Type:** `epic`
- **Priority:** P3
- **Parent:** `NXHX-ROOT`
- **Depends on:** none
- **Labels:** `bonus`, `contracthx`, `bridge`
- **PRD sections:** 26

Research a shared typed contract layer for NextJsHx clients and PhoenixHx/RailsHx native server adapters. This epic must not block core NextJsHx.

**Acceptance criteria**

- A decision report identifies a viable or rejected architecture.
- Any prototype keeps framework runtimes native and wire schemas typed.
- No public commitment is made without two-backend evidence.

### NXHX-X01 — Inventory PhoenixHx Live Event Protocol and RailsHx Hotwire/ActionCable contract primitives

- **Type:** `task`
- **Priority:** P3
- **Parent:** `NXHX-E7`
- **Depends on:** `NXHX-C07`, `NXHX-R04`
- **Labels:** `research`, `phoenixhx`, `railshx`
- **PRD sections:** 26.9

Map reusable schema, codec, manifest/hash, dispatcher, and generated-helper concepts from the supplied reference projects.

**Acceptance criteria**

- Inventory distinguishes reusable core concepts from framework-specific behavior.
- Existing names/APIs that should be reused or avoided are listed.
- Gaps are expressed as research questions, not implementation promises.

### NXHX-X02 — Write ContractHx architecture ADR and transport profile model

- **Type:** `decision`
- **Priority:** P3
- **Parent:** `NXHX-E7`
- **Depends on:** `NXHX-X01`
- **Labels:** `decision`, `adr`, `contracthx`
- **PRD sections:** 26.2, 26.4, 26.8

#### Decision

Select or reject a transport-neutral ContractHx architecture and first transport profile after comparing the available native-framework options.

#### Rationale

Any shared contract must remove duplicated wire declarations without replacing Next, Phoenix, or Rails runtime semantics or forcing local Next Server Functions through RPC.

#### Alternatives considered

- HTTP JSON with generated native adapters.
- Next Server Functions as a universal transport.
- Phoenix Channels or LiveView as the shared protocol.
- Rails ActionCable or Hotwire as the shared protocol.
- OpenAPI-first generation.

**Acceptance criteria**

- ADR selects HTTP JSON as first profile or records a justified alternative.
- Local Next Server Functions are explicitly excluded from forced RPC.
- Auth/CSRF/cookie/deployment differences are modeled.
- Core versus adapter package boundaries are proposed.

### NXHX-X03 — Prototype shared todo contract with Next server client and PhoenixHx adapter

- **Type:** `task`
- **Priority:** P3
- **Parent:** `NXHX-E7`
- **Depends on:** `NXHX-X02`
- **Labels:** `research`, `prototype`, `phoenixhx`, `http-json`
- **PRD sections:** 26.3, 26.5

Generate typed codecs/path builders, a Next server-side client, and a native Phoenix router/controller binding from one contract.

**Acceptance criteria**

- Round-trip positive and malformed-payload tests pass.
- Generated Phoenix output is native and readable.
- Contract hash/version drift is detected.
- No Dynamic/any wire model or custom runtime dispatcher is required in the happy path.

### NXHX-X04 — Add RailsHx adapter to the same ContractHx prototype

- **Type:** `task`
- **Priority:** P3
- **Parent:** `NXHX-E7`
- **Depends on:** `NXHX-X03`
- **Labels:** `research`, `prototype`, `railshx`, `http-json`
- **PRD sections:** 26.3, 26.9

Prove the exact same contract can generate a native Rails routes/controller binding without contorting Rails into Phoenix semantics.

**Acceptance criteria**

- Rails output is native and readable.
- Strong-parameter/forgery concerns are explicit.
- Positive/malformed/drift tests match the shared contract.
- Framework-specific adapter code remains separate from the core model.

### NXHX-X05 — Research same-origin BFF tooling, credentials, CSRF, and environment contracts

- **Type:** `task`
- **Priority:** P3
- **Parent:** `NXHX-E7`
- **Depends on:** `NXHX-X03`, `NXHX-X04`
- **Labels:** `research`, `security`, `bff`, `tooling`
- **PRD sections:** 26.6, 26.7

Design nextjshx bridge init around server-side backend clients, explicit header/cookie allowlists, local dev configuration, and typed environment values.

**Acceptance criteria**

- No design forwards all credentials by default.
- Phoenix and Rails CSRF/session differences are documented.
- Timeout/cancellation/retry/idempotency policy is explicit.
- Secrets remain server-only in the Next fixture.

### NXHX-X06 — Publish ContractHx research report and go/no-go backlog

- **Type:** `task`
- **Priority:** P3
- **Parent:** `NXHX-E7`
- **Depends on:** `NXHX-X05`
- **Labels:** `research-report`, `decision`
- **PRD sections:** 26.10, 26.12

Consolidate prototype evidence, naming, package split, risks, and a dependency-aware follow-up graph without folding speculative work into core NextJsHx.

**Acceptance criteria**

- Report compares both backend adapters.
- Acceptance bar from the PRD is scored honestly.
- Go/no-go recommendation is explicit.
- Approved follow-up work is created in Beads; rejected ideas are recorded with rationale.
