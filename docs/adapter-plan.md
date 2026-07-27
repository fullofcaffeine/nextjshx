# Adapter-plan contract

The adapter plan is the deterministic boundary between Haxe declaration
typing and later adapter rendering. Build macros register data; they never
write App Router convention files. After typing, the registry validates and
freezes the complete request set. It writes the JSON document only after Haxe
reaches its successful generation callback, which still runs with
`--no-output`; an ordinary typing failure therefore cannot leave a new empty
or partial plan for renderers and tooling.

The machine-readable contract is
[adapter-plan.schema.json](../schemas/adapter-plan.schema.json). Plans identify
that schema with
`https://nextjshx.dev/schemas/adapter-plan.schema.json` and currently require
`schemaVersion: 1`. A consumer must reject an unknown version rather than
guessing how to interpret it.

## Plan contents

Every plan records exact NextJsHx, Haxe, genes-ts, and Next.js identities plus
a canonical array of adapter intents. Each intent contains:

- a closed adapter kind;
- the Haxe source type and field;
- repository-relative, slash-normalized type, field, and metadata ranges;
- the App-Router-root-relative segment and target paths;
- the implementation module and symbol;
- exact imports and ordered directive literals;
- default or named exports with their validated signature strategy; and
- tagged literal config values, never arbitrary TypeScript expressions.

Schema v1 currently recognizes page, layout, loading, error, not-found, Route
Handler, client-component, react-hook, server-function, cache-function, proxy,
and mdx-components kinds.
These are additive closed-enum extensions within the unreleased development
contract; unknown kinds still fail instead of falling through to a generic
renderer.

For pages and layouts, the reviewed named-export vocabulary is `metadata`,
`generateMetadata`, and `generateStaticParams`. The reviewed config vocabulary
is `runtime`, `preferredRegion`, `dynamicParams`, `revalidate`, and
`maxDuration`. Config-bearing plans are tied to the exact Next 16.2.12 plugin
contract; the renderer rejects another version, an unknown name, a wrong tagged
value kind, or a config field duplicated as an implementation export. See the
[metadata and segment-config reference](metadata-and-segment-config.md).

A proxy intent is the one reviewed root convention exception to the
App-Router-relative output mapping. Its plan target remains the canonical
`proxy.ts`, its segment is empty, its only named export is typed as public
`NextProxy`, and optional config contains one literal `matcher` value typed as
`ProxyConfig`. The host renderer maps that intent to package-root `proxy.ts` or
`src/proxy.ts` only after discovering `app` or `src/app`; see the
[proxy reference](proxy.md).

An mdx-components intent is the second reviewed root convention exception. It
has an empty segment, targets exactly `mdx-components.tsx`, imports one closed
Haxe registry, and publishes `useMDXComponents` as a zero-wrapper `typeof`
alias. The host maps it to package-root `mdx-components.tsx` or
`src/mdx-components.tsx` after discovering `app` or `src/app`. See the
[MDX and portable-content reference](mdx-and-content.md).

A client-component intent targets one ordinary `.tsx` file below the App Router
root. It requires exactly one first-position `use client` directive, one runtime
implementation import, one type-only React `ComponentType` import, one default
`render` export with the precise implementation-prop signature, and no config.
The server-facing macro imports that generated adapter rather than the raw
implementation; see the [Client Component reference](client-components.md).

A react-hook intent targets one private `.ts` file below `_nextjshx/hook/`.
It requires exactly one first-position `use client` directive, one runtime
implementation import, one same-name use-prefixed named export typed as
`typeof Implementation.field`, and no config. The renderer emits a const alias
rather than a wrapper function, preserving generics without another call. See
the [React Hook and interop reference](react-hooks.md).

A server-function intent targets one ordinary `.ts` file below the App Router
root. It requires exactly one first-position `use server` directive, exactly
one runtime implementation import, one or more same-named named action exports,
and no config. Each generated export is an actual async wrapper whose rest
tuple and awaited result are derived from the implementation field through
`Parameters`, `ReturnType`, and `Awaited`. Consumers use the macro-backed
generated ref rather than the raw implementation; see the
[Server Function reference](server-functions.md).

A cache-function intent targets one private `.ts` file below
`_nextjshx/cache/`. It requires exactly one reviewed cache directive, one
runtime implementation import, one or more same-named async exports, and no
route config. Unlike a module directive, its `"use cache"`, `"use cache:
private"`, or `"use cache: remote"` literal is rendered inside every wrapper
function. `Parameters`, `ReturnType`, and `Awaited` preserve the implementation
signature without `any`, `unknown`, or a cast. Pages and layouts may carry one
of the same directives at module scope; the renderer places it before imports
and requires async implementation exports. See the
[Cache Components reference](cache-components.md).

Source lines and characters use Haxe's one-based `PositionTools` locations.
Absolute compiler-host paths are rejected and never serialized.

## Canonicalization

The registry applies these deterministic rules before encoding:

- intents sort by target path, adapter kind, then Haxe source name;
- imports sort by module, symbol, alias, then type-only status;
- default exports precede named exports, whose names sort bytewise;
- config entries sort by name;
- directive and string-array order is preserved because it can be semantic;
- proxy matcher arrays are sorted bytewise and deduplicated by their declaration
  macro before entering that preserved plan representation;
- input arrays are copied before they enter the immutable plan model; and
- JSON keys and two-space layout have a fixed encoder order and final newline.

Duplicate imports, directives, export names, config names, or adapter targets
fail with stable `NXHX-PLAN-*` diagnostics. Two intents requesting the same
target fail at the canonical second source's metadata position and name both
declarations. All registrations are canonicalized and collision-checked before
the plan directory or file is written.

Host tooling may pass a unique control path with the compiler define
`nextjshx.adapter-plan-output`. The registry validates that override as a
portable relative JSON path and uses it instead of the build macro's fallback.
This lets concurrent or crashed command runs distinguish a fresh plan without
trusting a stale fixed filename; it does not change adapter intent or grant
write authority.

The CLI also supplies `nextjshx.app-root` and `nextjshx.generated-root` from
validated project discovery. Declaration macros use those internal values to
derive extensionless implementation imports relative to each convention file.
It derives the three cache capability defines from validated Next
configuration as well. All six `nextjshx.*` defines are CLI-owned and rejected
in application configuration, so a project cannot redirect plan bytes,
adapter imports, or cache capabilities by shadowing orchestration inputs.

## Boundary of authority

A valid plan describes requested bytes; it does not prove ownership of a live
file. It does not render TypeScript, mutate `app/**`, replace native routes, or
authorize cleanup. Rendering and transactional manifest-owned publication are
separate phases governed by ADR 0001 and their dedicated Beads.

The focused evidence command is:

```sh
npm run test:adapter-plan
npm run test:metadata-segment
npm run test:proxy
npm run test:client-components
npm run test:mdx-components
npm run test:server-functions
npm run test:cache-boundaries
```

It requires byte-identical plans from opposite registration orders, validates
the JSON Schema and reviewed snapshot, checks portable source ranges, prevents
application output, and proves duplicate-target failure preserves existing
plan bytes. The metadata/config suite separately locks the closed named exports,
literal tags, route-matched static-param signatures, and host renderer output.
The cache suite proves exact function/module directive scope, capability
gating, serializable signatures, strict Next build behavior, cache-key reuse,
and tag invalidation.
