# ADR 0007: Reviewed npm package integrations

- Status: Accepted
- Date: 2026-07-20
- Decision owners: project owner and NextJsHx maintainers
- Related Beads: `nxhx-ble.1`, `nxhx-ble.1.1`
- Related PRD sections: 6.2, 12.4, 15.3, 16.2, 17.2, 18

## Context

Real Next.js applications compose many npm packages. A Haxe application must
be able to use those packages without waiting for each upstream API to become a
compiler feature, but a loose extern containing `Dynamic`, `Any`, `unknown`, a
cast, or guessed overloads would move failures later and erase the main benefit
of NextJsHx.

The maintained showcases already exercise a useful boundary: shadcn components
remain application-owned TSX over Radix, while matching Haxe externs expose the
closed props the applications use. The flagship Todo and architecture examples
also need generic Hooks, headless drag/drop, command and table behavior, and
visual components. Those integrations need one repeatable ownership, version,
upgrade, and evidence contract.

The useful lesson from RailsHx gem adoption is “precise or omitted.” Host
metadata is an oracle, not permission to invent a broad fallback. NextJsHx has
a stronger source oracle than Ruby gems usually do—published TypeScript
declarations—but TypeScript declarations can still contain conditional types,
open records, overloads, polymorphic components, and broad internal carrier
types that are not sound Haxe application APIs.

## Decision

### Treat installed public declarations as the boundary oracle

Every maintained integration is tied to one exact npm package version, lockfile
integrity, license, canonical repository, public module specifier, import-mode
declaration entry, declaration SHA-256, and the exact exports NextJsHx uses.
`config/package-integrations.json` is the reviewed record and
`schemas/package-integrations.schema.json` is its closed format.

The checker resolves the installed package through TypeScript's bundler module
rules, follows the package's public `exports` map, parses declaration exports
with the TypeScript compiler, and fails on drift. It does not scan private
package internals to discover an accidental API.

### Keep integrations precise or omit unsupported surface

One integration exposes only the reviewed slice needed by executable examples.
An unsupported declaration shape receives a clear omission or diagnostic; it
does not become a broad Haxe type. Upstream declarations may use `any` or
`unknown` internally, but repository-owned Haxe, native adapters, and public
generated modules may not leak those types.

The integration manifest records which strategies own the seam:

- `raw-extern` for a faithful host-shaped subset;
- `semantic-facade` when Haxe can name intent, infer more, or reject invalid
  states earlier without changing runtime semantics;
- `native-source` plus `haxe-facade` for source-distributed components such as
  shadcn; and
- `generated-adapter` only when a directive, public export, or convention module
  must exist as ordinary TypeScript/TSX.

Third-party raw bindings live under `nextjs.raw.integrations.<package>` and
semantic authoring APIs under `nextjs.integrations.<package>`. Application-owned
components keep their application or shared-package namespace. This avoids
presenting a third-party package as part of Next's own compatibility surface.

### Preserve native package ownership and runtime identity

Next.js, React, and the package retain runtime ownership. NextJsHx does not copy
a dependency into the compiler, fork it, implement a second drag/drop or URL
state runtime, or rewrite source-distributed application components into Haxe
merely to remove TSX. One canonical public ESM specifier must reach one package
identity.

Source-owned TSX is appropriate when the package's normal distribution model
expects the application to own and customize that source, as shadcn does. Haxe
then exposes a precise facade and consumes the native module exactly as a
handwritten TSX application would.

### Require bidirectional and runtime evidence

Depending on the integration category, evidence includes:

- positive and exact negative Haxe fixtures;
- deterministic emitted TypeScript/TSX and classic JavaScript parity where the
  surface is target-neutral;
- strict TypeScript against the installed declarations;
- React Hook lint and Next production builds for client behavior;
- Haxe consuming native Hooks/components/modules and native TypeScript
  consuming Haxe-authored exports;
- browser keyboard, pointer, focus, history, hydration, and recovery behavior;
  and
- a clean packed consumer when the integration is part of a published artifact.

The shared harness checks version, export, declaration, license, integrity, and
owned-source drift before these behavior lanes run.

### Make upgrades explicit reviews

An npm update that changes a reviewed package cannot be accepted by changing
only `package-lock.json`. The maintainer inspects the new public declaration,
updates the exact manifest identity and digest, reviews the Haxe surface, runs
positive and negative controls, and records why the integration changed.

A positive package addition therefore records, for example, that
`@radix-ui/react-slot` exports `Slot` from its public import declaration and
that the source-owned Button/Badge TSX plus Haxe facade exercise it. A negative
control changes the expected export or declaration digest and must fail before
Haxe or Next application output is trusted.

## Consequences

- Package support is a visible compatibility promise rather than an incidental
  import that happens to compile.
- Haxe applications receive smaller, discoverable surfaces with earlier errors,
  while exact native APIs remain reachable through reviewed raw externs.
- Declaration and lockfile drift is noisy by design; a patch release can change
  types even when runtime behavior appears unchanged.
- The first portfolio set is split into durable work: the shared harness,
  generic nuqs URL state, Radix/shadcn polymorphism, and accessible dnd-kit
  sorting. Motion and larger table/chart integrations build on the same contract
  when their owning examples need them.
- Third-party internal broad types are not mistaken for permission to weaken
  repository-owned APIs.

The operational workflow and manifest field reference are in
[package-integrations.md](../package-integrations.md).

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| Copy all upstream declarations mechanically | TypeScript's full type system does not map soundly to Haxe, and broad fallbacks would create false safety. |
| Handwrite externs without version provenance | Package upgrades could silently invalidate imports, callbacks, or runtime assumptions. |
| Put third-party packages directly in `nextjs.raw.*` without an integration namespace | It confuses the stable Next public surface with separately versioned ecosystem support. |
| Rewrite source-owned shadcn TSX into Haxe | It forks the normal ownership/update model and makes existing React code harder to adopt. |
| Hide a package behind a NextJsHx runtime wrapper | It creates another runtime identity and changes debugging, bundle, or framework behavior. |
| Accept `Dynamic`, `Any`, broad `unknown`, casts, or assertions at package seams | It delays exactly the errors the Haxe layer exists to catch. |
| Pin only an npm version | Export maps and declaration bytes can still drift through lock or packaging changes; integrity and declaration evidence are required. |
| Claim support from compile-only examples | Hooks, focus, history, drag/drop, hydration, and keyboard behavior require runtime evidence. |
