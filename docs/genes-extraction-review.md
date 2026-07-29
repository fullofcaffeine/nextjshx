# Genes extraction review

This review applies the repository rule that reusable Haxe-to-JavaScript or
Haxe-to-TypeScript mechanisms belong in genes, while NextJsHx owns only
Next.js-specific policy and composition.

## Decision test

A capability belongs in genes when all of these are true:

1. Its input can be described without a Next.js convention, package, route, or
   runtime concept.
2. Its output is a general JavaScript, TypeScript, JSX, React, Web, compiler,
   declaration, source-map, or generated-file contract.
3. A second host such as WordPressHx/Gutenberg could use the same API without
   importing a `nextjs.*` type.
4. NextJsHx can consume the result by adding only Next-specific placement,
   classification, validation, or diagnostics.

Framework pressure may discover the need, but it must not appear in the genes
API, fixture names, diagnostics, or implementation branches.

## Extract to genes

| Generic mechanism found here | Evidence in NextJsHx | Genes responsibility | NextJsHx responsibility | Bead |
| --- | --- | --- | --- | --- |
| React Hook and component authoring | Former local state/optimistic abstracts, Hook bindings/macros, computed dependency snapshots, placement checks, and analyzer-function lowering | Precise React bindings, semantic `State`/`Optimistic`, dependency and placement checks, and analyzer-visible functions under `genes.react` | `@:next.hook` and Client Component ownership, Next client/server graph rules, cached-resource `use`, Transition composition, and Next build evidence | Extracted by `genes-wr91`, [genes-ts PR #69](https://github.com/fullofcaffeine/genes-ts/pull/69), and computed-snapshot [genes-ts PR #72](https://github.com/fullofcaffeine/genes-ts/pull/72); NextJsHx now consumes it directly |
| Flight-shaped React transport values | Former `nextjs/client/flight/**` value definitions and Client/Server boundary validation | Versioned native React 19 values, recursive closed validation, structured issue kinds/paths/positions, host-proven nominal extensions, and semantic-only compatibility-alias projection under `genes.react.flight.v19` | Next Server/Client classification, module-stable Promise and generated Server Function provenance, cached-resource policy, raw Next ReactNode view, RSC graph rules, `NXHX-*` diagnostics, and Next runtime/build/browser evidence | Released in genes-ts v1.40.0 by PR #78 and consumed by `nxhx-f34.2.18`; the full downstream Client Component, strict Next build, streamed Flight, and hydrated-browser gates pass |
| Exact generic boundary preservation | `nextjs.codec.Decode.accept(...)` must retain a closed enum-abstract result after Haxe erases its String backing representation | Compile-time-only type witnesses for marked generic externs and directly emitted generic Haxe callables, plus safe undefinable presence proofs that erase from classic JavaScript | Compose the generic proof inside a semantic decoder and retain Next-specific form/action diagnostics and runtime evidence | Released in genes-ts v1.41.0 by PRs [#86](https://github.com/fullofcaffeine/genes-ts/pull/86), [#88](https://github.com/fullofcaffeine/genes-ts/pull/88), and [#90](https://github.com/fullofcaffeine/genes-ts/pull/90); the Todo decoder emits the exact closed TypeScript union without an assertion |
| Idiomatic JavaScript collection authoring and exact portable lowering | Example catalog/search/reduction code where Haxe `Lambda` helpers would retain an indirect support module instead of native Array operations | A faithful `genes.js` Array surface for reviewed ECMAScript methods such as `find`, `findIndex`, `some`, `every`, `flatMap`, `reduce`, `reduceRight`, and `at`, including `undefined`, sparse-array, callback, mutation, and evaluation-order semantics; separately, semantics-preserving lowerings for exact portable Haxe collection calls when equivalence is proven | Choose the faithful JS-first or portable Haxe contract deliberately, use it in HXX/application modules, and verify generated Next code stays idiomatic; no Next-specific collection facade | Upstream `genes-d2pl` |
| Reviewable TS/TSX/JS/JSX and end-to-end debugging | Compiler-gap fixtures and the output-profile policy in `tools/cli/src/profile.ts` | Module-function lowering, direct JSX, stable readable names, removal of avoidable Haxe runtime metadata, declarations, source maps, and generic stack provenance | Protected Next/React analyzer boundaries, Next overlay verification, profile admission, and application diagnostics | `nxhx-f34.2.19` |
| Stable Haxe-to-native public ESM exports | Private client/Hook adapter identities and mixed-adoption imports | Per-member DCE roots, named ESM exports, stable declarations, generics, and profile-independent public identity | Public module placement, `"use client"`/`"use server"` classification, and rejection of contradictory Next graph boundaries | `nxhx-f34.2.20`; upstream `genes-nztq`, [genes-ts PR #65](https://github.com/fullofcaffeine/genes-ts/pull/65) |
| Project-local TS/JS declaration binding | `scripts/bindings/**`, hand-authored package externs, and `examples/mixed-adoption/**` | Static package/workspace/export-map inspection, deterministic dts2hx projection, lock/declaration fingerprints, and unsupported-construct reports | Reviewed Next entrypoints, server/client classification, framework capability inventory, and semantic facades that encode Next behavior | `nxhx-f34.2.21` |
| Static ESM resource imports and typed CSS-module symbols | `genes.ts.Imports.sideEffect` use, custom style watching, and missing CSS-module authoring | Ordered literal side-effect/default resource requests, asset module identity, and deterministic closed CSS class companions | Legal Next convention placement, CSS ordering/build/HMR evidence, `next/font`, and Next asset policy | `nxhx-f34.2.22` |
| Closed decoders and schema derivation | `nextjs/codec/**`, `nextjs/content/PortableContentDecoder.hx`, form/query/request decoding, and repeated action codecs | Generic JSON, text, exact-object, FormData, URLSearchParams, Request, issue/path, and specialized schema generation with no reflection | Server Action reserved fields, Next request/response adapters, route query integration, and action diagnostics | `nxhx-f34.2.23` |
| Optimization policy and evidence | `reviewable \| optimized` is currently a NextJsHx configuration axis without a generic transformation owner | Transformation registry, semantic preconditions, protected-boundary inputs, applied/skipped reports, differential tests, composed maps, and benchmarks | Which transformations a Next profile admits and the Next/React analyzer and final-pipeline gates | `nxhx-f34.2.24` |
| Crash-safe generator orchestration | genes owns implementation publication while `tools/cli/src/generated-output-publisher.ts` owns adapters, validation, last-good recovery, and a separate journal | A separate `genes.tooling` host kernel for exact file transitions, durable journals, rollback, HXML/watch reconciliation, serialized writers, and an owned Haxe wait server; see the [decision report](genes-generator-orchestration-decision.md) | App Router ownership transfer, native collisions, Next validation, Next dev-server lifecycle, and `NXHX-*` diagnostics | `nxhx-f34.2.25` |
| Request-local output target selection | `tools/cli/src/config.ts` derives language/profile defines, but an HXML already owns the single Haxe `-js` target | One generic compile-request override that remains inside genes `OutputTransaction` and controls TS/TSX/JS/JSX output without a second target | Select the configured profile and isolated root; never mutate compiler output after genes publishes | `nxhx-f34.2.26`; upstream `genes-ge9q`, [genes-ts PR #54](https://github.com/fullofcaffeine/genes-ts/pull/54) |

The extraction order matters. Output selection and orchestration must precede
transactional NextJsHx profile switching. Reviewable output, stable exports,
and package/resource binding can then be consumed without inventing
Next-specific compiler mechanisms.

## Generic, but not automatically genes

Some code is not inherently Next-specific but is also not compiler or
JavaScript/TypeScript infrastructure:

| Current surface | Disposition |
| --- | --- |
| `nextjs/content/**` domain block models | Move only if a separate reusable content package has a real second consumer. The decoder primitives belong in genes; the application content algebra does not. |
| `nextjs/server/{Authentication,Authorized,GuardedAction,...}` | Keep out of genes. This is application security workflow policy and should become a separate security/domain library only with independent consumers. |
| Hand-designed nuqs, dnd-kit, Recharts, cmdk, Radix, or shadcn facades | The declaration/import generator is genes tooling. Package-specific semantic facades should live in independently versioned integration libraries when another React host needs them, not in the compiler core. |
| Named environment access | The low-level Node environment binding is reusable, but the current `@:next.serverOnly` classification and poisoning contract are Next-specific. Defer a `genes.node` accessor until another host proves the common API. |
| Generated agent guidance and capability manifests | Registry and file-generation techniques may be reusable tooling, but capability contents, ownership commands, and supported/native-only decisions are framework policy. Do not move them into the compiler merely because they are machine-readable. |

## Keep in NextJsHx

The following contracts are inherently Next-specific:

- App Router path parsing, groups, slots, interception, params, route hrefs,
  pages, layouts, Route Handlers, special files, proxy, MDX, and metadata;
- Client/Server Component graph classification and generated refs;
- `"use server"` Server Functions, Next serialization constraints, and action
  transport;
- Cache Component directive variants, request-data restrictions, cache tags,
  and revalidation policy;
- adapter planning, App Router filename/export rendering, native/generated
  ownership transfer, and Next typegen/build validation;
- Next package declaration inventory and compatibility policy.

These layers may consume generic genes functions, exports, imports, maps,
declarations, React typing, codecs, and transactions. Their public vocabulary
and diagnostics remain in NextJsHx.

## Admission rule for future work

Before adding a new compiler-adjacent feature here:

1. inspect the pinned/current genes API, documentation, and executable fixtures;
2. consume the existing generic capability directly when it already satisfies
   the contract—do not duplicate it locally or create a competing abstraction;
3. only when the capability is missing, reduce the gap to a framework-neutral
   Haxe/JS/TS statement and prove it with a minimal generic fixture;
4. name a plausible non-Next consumer;
5. file or link the genes task and its generic fixture;
6. keep only the Next adapter or policy locally;
7. pin the released genes identity before making NextJsHx depend on it.

If the reduction still contains a route, Next directive, App Router target,
Next package type, or Next runtime rule, the remaining part belongs here.
