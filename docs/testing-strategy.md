# Testing strategy

NextJsHx uses small evidence layers so a generated snapshot cannot substitute
for a real type check or runtime result. The baseline harness is intentionally
framework-light: later Beads add feature fixtures to these contracts rather
than inventing one-off runners.

## Baseline commands

```sh
npm run test:architecture
npm run test:haxe:positive
npm run test:haxe:negative
npm run test:adapter-plan
npm run test:routes
npm run test:page-layouts
npm run test:metadata-segment
npm run test:route-handlers
npm run test:special-files
npm run test:proxy
npm run test:route-hrefs
npm run test:environment-boundaries
npm run test:clientification-boundaries
npm run test:client-components
npm run test:server-functions
npm run test:cache-boundaries
npm run test:config-discovery
npm run test:ownership-preflight
npm run test:publication
npm run test:cli
npm run test:dev
npm run test:snapshots
npm run test:package-shape
npm run test:compiler-gaps
npm run test:next-surface
npm run test:next-bindings
npm run test:next-drift
npm run test:next-core-navigation
npm run test:next-components
npm run test:showcase-ui
npm run integrations:check
npm run test:integrations
npm run test:next-server
npm run test:codecs
npm run test:harness
npm run test:example:todoapp
```

`test:harness` runs all evidence layers. The root `npm test` also runs the strict
Next fixture plus the production todo-app build, HTTP smoke, and browser flow,
so it remains the complete local gate.

## Local and hosted gates

The gates are deliberately cumulative:

- **Pre-commit** formats fully staged repository-owned Haxe, rejects whitespace
  and machine-local paths, validates staged JSON, scans staged bytes with
  Gitleaks, and selects only fast contracts affected by the staged paths.
- **Pre-push** scans every reachable Git revision and decoded Beads history,
  validates the security bootstrap, and runs `npm run test:prepush`. That gate
  covers Haxe positive/negative fixtures, adapter and route plans, snapshots,
  compiler gaps, and the clean package shape without starting Next servers or
  browsers.
- **GitHub Actions** runs independent parallel jobs for full-history secrets,
  exact Haxe formatting, dependency security, compatibility on the minimum and
  current Node versions, stable Next declarations, Turbopack and webpack
  production builds, the reusable typed-boundary harness, maintained
  showcases, and the flagship production Playwright suite. Canary declaration
  drift is visible but non-blocking.
- **Publication preflight** (`npm run public:preflight`) is the complete local
  release gate. It combines formatting, whitespace, both history scans,
  dependency auditing, every compiler/integration fixture, production builds,
  and browser evidence.

This split keeps ordinary commits responsive without allowing a fast local
check to stand in for the complete hosted or publication evidence.

The dependency gate also protects the reviewed host toolchain, not only Haxe
source. The current lock keeps React and React DOM at 19.2.7, the TypeScript
compatibility wrapper on compiler core 6.0.2, and the audited override of
PostCSS to 8.5.23. `npm run security:audit` rejects
moderate-or-higher findings, while the pinned production fixture proves those
resolutions still build and run together.

## Boundary-decision evidence

`npm run test:architecture` validates every ADR's required metadata and
sections, accepted-index links, and architecture index. ADR 0003 additionally
locks the seven-category boundary model, one-Haxe-module rule, generated
component/action refs, targeted DCE policy, generic directive and side-effect
primitives, Haxe/renderer/Next enforcement split, cache request-API limits,
environment containment, and all rejected alternatives.

ADR 0004 additionally locks server-default and neutral component semantics,
zero-argument client declarations, the caller-sensitive `.client()` static
extension, deterministic private adapter targets, children/slot composition,
native async Server Components with Suspense/error handling, third-party and
native TypeScript interop, compatibility migration, the layered evidence split,
and rejected nominal/direct-emission/custom-runtime alternatives.

This is contract evidence, not a substitute for the downstream executable
fixtures. Client components, Server Functions, cache boundaries,
serializability, and explicit environment markers each provide Haxe failures,
strict generated TypeScript, `next build`, and runtime/browser or HTTP proof
under that decision. The architecture test prevents those implementations from
silently redefining the graph.

## Environment-boundary and containment evidence

`npm run test:environment-boundaries` compiles explicit `@:next.serverOnly`
and `@:next.clientOnly` modules twice in both genes-ts output profiles and
requires byte-identical generated trees. Six exact side-effect imports must
remain binding-free and ahead of application statements under full DCE. The
focused semantic modules are also rejected if they contain TypeScript `any`, a
compiler cast, suppression, private Next import, or compiler-host path, and the
complete Next fixture runs with strict TypeScript and `skipLibCheck: false`.

Four isolated Haxe negatives require exact source-positioned diagnostics for
client request-header access, client-to-server-only import, server-to-client-
only import, and two boundary owners in one Haxe module. Those early checks are
deliberately incomplete: the harness separately creates a native TypeScript
Client Component that imports the generated server-only implementation and
requires pinned `next build` to fail. Next remains the final graph oracle.

The positive production build receives one named sentinel through
`ServerEnvironment.get`, proves server rendering observed it, and scans every
browser JavaScript chunk. The client-only helper must be present while both the
server environment key and its sentinel value are absent. This is executable
containment evidence for the fixture, not a claim that a marker sanitizes
values returned in HTML, props, or Server Function results. The complete
contract is in [environment-boundaries.md](environment-boundaries.md).

`npm run test:clientification-boundaries` builds two equivalent routes through
the real CLI and pinned Next production compiler. The positive route
server-renders a substantial shared catalogue and hydrates one leaf counter;
the negative control places the client boundary above the catalogue. Its
deterministic report must stay path-sanitized, map both adapters to final
client-reference chunks, show the catalogue only in the high Haxe dependency
subtree, and measure the leaf closure as smaller. See
[clientification-reports.md](clientification-reports.md).

## Client Component and serializable-prop evidence

`npm run test:client-components` compiles one Haxe-owned hydrated component and
one server page twice, requires identical generated tree digests, validates the
schema plus reviewed plan snapshot, and checks that the server module imports
only the generated boundary adapter. The adapter must contain exactly one
first-position `"use client"`, retain a precise
`ComponentType<Parameters<typeof Implementation.render>[0]>` signature, and
keep the implementation reachable under full Haxe DCE.

The positive fixture exercises strings, booleans, integers, floats, a string
enum abstract, nested immutable records, arrays, nullability,
undefined-capable values, ReactNode child composition, a reviewed Next Hook, a
Haxe custom Hook, raw and semantic state/memo tuples, generic Haxe Hook export,
native TSX consumption, import aliasing, an ordinary `use*` helper, and conditional
and looped React `use` over `CachedPromise`. Twenty-eight isolated failures lock
exact paths and messages for the original prop/graph controls plus Hook
conditions, aliases, loops, callbacks, event handlers, protected blocks,
post-return and outside-render calls, special `use`, uncached Promise input,
locally provable purity defects, callable semantic state, non-inline memo
dependencies, wrong replacement values, and unreviewed Hook exports. Failed
typing must not leave an adapter plan.

The runner then builds the actual host CLI, publishes the adapters into a clean
Next fixture, runs the pinned official React Hook/dependency/purity rules on applicable
native/adaptor TSX plus independent negative controls, runs strict TypeScript
and a Next 16.2.12 Turbopack production build, and regenerates to prove byte
stability. A production browser observes `usePathname`, the server-composed
child, and a hydrated Haxe counter click from `2` to `3`; page errors, console
errors, and failed responses are all fatal. The normative contract is in
[client-components.md](client-components.md) and
[react-hooks.md](react-hooks.md).

## Server Function and action-ref evidence

`npm run test:server-functions` compiles a Haxe-owned native action module, a
Client Component action consumer, and a Server Component observer twice. It
requires identical generated trees and plans, exact `use server` plus named
async wrapper signatures, and a client implementation that imports only the
generated action ref with its precise `FormData -> Promise<Void>` type.

Eight isolated failures reject a synchronous export, a class argument, a broad
result, an optional argument, a convention-colliding path, an unmarked public
field, an invalid ref, and a raw Client Component-to-action implementation
edge. No failure may leave a plan. The renderer unit lane also refuses missing
directives, wrong imports, weakened signatures, renamed exports, or route
config on the action module.

The runner publishes through the real CLI, runs strict TypeScript and a Next
16.2.12 Turbopack production build, then submits a native form in Chrome. The
HTTP exchange must execute the Haxe action, set an HTTP-only SameSite cookie,
and expose the mutation through a re-rendered Haxe Server Component. Codec
evidence proves React's reserved `$ACTION_*` field is hidden without allowing
an arbitrary extra form field. Page errors, console errors, and failed
responses are fatal. The normative declaration, value, transport, and security
contract is in [server-functions.md](server-functions.md).

## Cache Component and invalidation evidence

`npm run test:cache-boundaries` compiles shared, private, and remote standalone
cached functions plus a module-cached page twice. It requires identical plans,
validates the closed `cache-function` intent, and proves that function
directives occur inside each precise async wrapper while the page directive is
the first bytes of its convention module. Generated consumers import the
cached adapter rather than the raw implementation, and no plan or adapter may
contain `any` or `unknown`.

Nine isolated failures reject a known direct request-header read from ordinary
caching, missing Cache Components authorization, private caching without its
experimental opt-in, a synchronous cached function, a class-valued argument,
a synchronous module-cached page, Cache-Components-incompatible
`dynamicParams` and `revalidate` segment exports, and a page importing the raw
cached implementation instead of its generated ref. Failed typing must not
publish a plan.
Renderer tests independently reject unsupported directives, unsafe targets,
weakened signatures, config fields, and a Next version other than 16.2.12.

The runner publishes with the real CLI, runs strict TypeScript and a pinned
Next Turbopack production build, and checks deterministic regeneration. It
then starts `next start` and calls the Route Handler: two equal keys must reuse
one invocation, a different key must compute separately, and an immediate
`revalidateTag` must force the first key to compute again. Private and remote
variants receive directive/build proof; the runtime semantics exercised here
are deliberately the stable shared-cache path. The normative capability,
authoring, and security contract is in
[cache-components.md](cache-components.md).

## Public-surface inventory evidence

`npm run test:next-surface` renders the reviewed Next 16.2.12 allowlist twice
through the pinned TypeScript 6.0.2 checker and requires both results to match
the checked manifest byte for byte. It reverses the source entrypoint, export,
and exclusion arrays and requires the same normalized output, independently
recomputes the aggregate surface hash, and verifies the exact P0/P1/P2 module
classification and package-relative declaration paths.

The fixture also proves that every `next/dist/**` declaration origin is indexed
separately with no compatibility promise and no allowed runtime import. It
checks that Web `Request` comes only from the pinned DOM library and that a
publicly declared overload such as `next/cache.cacheLife` is not mislabeled as
internal. Negative cases reject a missing export, a wrong export kind, a wrong
Next version, a changed signature hash, and an unknown fixture reference. The
normative selection and update policy is documented in
[binding-policy.md](binding-policy.md).

## Declaration-ingestion and drift evidence

`npm run test:next-bindings` renders the binding IR, generated
`ServerRuntime.hx`, curated implementation records, and clean JSON/Markdown
drift reports twice and requires byte-for-byte equality with the checked
files. It independently recomputes canonical IR, generated-file,
curated-source, and report hashes; verifies exact Next 16.2.12 and TypeScript
6.0.2 identities; and accounts for all 68 exports and 78 selected declaration
nodes without install-tree or machine-local paths. The checked implementation
manifest must account for the exact 38 B03-B04 exports and 34 source outputs;
the B05 manifest must then account for 27 more P0 exports and 21 more source
outputs. The final state is 65 curated exports, one generated export, and only
the two reviewed P2 `next/og` and `next/web-vitals` exports still pending.

The safety matrix requires all upstream `any` and `unknown` occurrences to
have one signature-pinned reviewed action and compares the complete eight-entry
exception set to a checked snapshot. A supported literal-union probe succeeds;
a mapped-type probe must report the construct and stop before Haxe emission.
The generated positive Haxe fixture accepts the three Next runtime literals
and `undefined` absence, while the paired compile-fail probe rejects an
arbitrary `"deno"` string.

Synthetic valid IR candidates exercise every drift decision: an internal-only
declaration move is compatible, a new export is additive, changed declaration
documentation requires behavioral review, and a removed export is breaking
with its owner and fixture. The test also proves that CI cannot run the update
mode and that a changed generated extern is refused without an exact
`acceptedTransitions` record. The normative parser, override, and review rules
are documented in [binding-policy.md](binding-policy.md).

## Installed and upstream declaration-drift evidence

`npm run test:next-drift` exercises the real package-root projection rather
than stopping at synthetic IR. It renders the installed Next 16.2.12 surface
twice, requires byte-identical JSON/Markdown reports, and proves that the
candidate IR hash is exactly the checked stable hash. This is the local form of
the blocking `npm run drift:next:stable` CI lane.

Negative candidate packages are modeled without changing `node_modules`: one
reviewed export is absent and one changes kind. Both produce a blocking report
whose stable diagnostic names the exact owning binding Bead and fixture. A
separate candidate moves an unchanged declaration between internal paths and
must remain compatible with zero breaking changes. Without that normalization,
routine Next refactors could look like public API breaks; without the negative
controls, a real removed or changed public export could be mislabeled as a
private move.

`npm run drift:next:upstream` reads either the exact configured, clean source
checkout or the package root named by `NEXTJSHX_NEXT_PACKAGE_DIR`. It writes a
separate candidate surface plus classified JSON and Markdown under
`.nextjshx/next-drift/`; it never changes the checked stable surface or IR. CI
installs `next@16.3.0-canary.87` without lifecycle scripts and runs this lane as
non-blocking early warning, while always copying the Markdown report into the
workflow summary. The observed canary currently reports two breaking signature
changes and two behavioral reviews, demonstrating why canary evidence cannot
be accepted by refreshing the stable hashes. The report's **Actionable Beads**
section maps the current `NextConfig`, `next/image`, and `revalidateTag`
findings to `nxhx-r5o`, `nxhx-q90`, and `nxhx-u5n`; the package-version row is
lane identity, not a separate product-surface task.

## Blocking Node and bundler matrix

The stable production fixture runs as a four-cell blocking matrix:

| Node.js | Turbopack | webpack |
| --- | --- | --- |
| 20.9.0, the declared engine floor | build + runtime smoke | build + runtime smoke |
| 24.18.0, the pinned current LTS | build + runtime smoke | build + runtime smoke |

Every cell compiles Haxe, publishes owned adapters transactionally, runs Next
type generation and strict TypeScript, builds the pinned Next 16.2.12
application, and exercises the same HTTP and browser smoke contract. This
distinguishes the actual minimum supported Node release from the 20.19.3
development baseline, and makes webpack compatibility a tested statement
rather than a planned one.

## Core and navigation parity evidence

`npm run test:next-core-navigation` compiles one positive Haxe consumer through
genes-ts, then validates the emitted output against the pinned public Next
16.2.12 declarations with strict TypeScript 6.0.2 and `skipLibCheck: false`.
The consumer calls every selected `next/navigation` runtime export, every
supported router and read-only search-params method, both exact runtime
`RedirectType` properties, the nullable compat router, and all six B03 root
types.

Output assertions require public namespace imports from `next/navigation` and
`next/compat/router`, reject every `next/dist/**` import and TypeScript `any`,
and prove each redirect/error wrapper returns exact TypeScript `never`. They
also lock the `NextConfig` `any`-to-`unknown` safety projection, exact
Metadata/Viewport/Route projections, and cast-free runtime redirect literals.

Three focused Haxe failures reject mutation through
`ReadonlyURLSearchParams`, an arbitrary redirect literal, and a non-Boolean
router option. A separate generated-TypeScript failure proves the raw open
Metadata representation does not bypass Next's nested validation and that a
fixed `useParams` target must satisfy Next's public generic constraint. The
runner deletes all temporary output on success or failure.

## Component and font TSX parity evidence

`npm run test:next-components` compiles one HXX consumer that uses all 18 B04
exports, then runs strict TypeScript 6.0.2 with `skipLibCheck: false` against
Next 16.2.12 and React 19. The emitted consumer must import Link, Image, Form,
dynamic, Script, Inter, Roboto, and local font directly from their public Next
entrypoints. Local Haxe modules may appear only as type imports; a component or
font wrapper import fails the test. The runner also rejects `next/dist/**` and
TypeScript `any` anywhere in the emitted B04 boundary.

The consumer also renders `nextjs.raw.react.Suspense`, requiring a direct
public named import from React and strict checking of `fallback`, `name`, and
children. This small shared React surface was added when Cache Components
required the maintained todo app's request-time list beneath a Suspense
boundary; keeping it in `nextjs.raw.react` avoids an app-specific wrapper.

The same positive fixture references `NextLink`, `NextImage`, `NextForm`, and
`NextScript` only as HXX tags. Exact output assertions prove each semantic,
JSX-safe name survives as a capitalized component import and tag and never
becomes the intrinsic `<link>`, `<img>`, `<form>`, or `<script>` spelling. This
guards a collision first found during real showcase prerendering without
weakening or replacing the faithful raw bindings.

The positive fixture covers required and spread props in actual TSX,
`useLinkStatus`, `getImageProps`, static image metadata, a custom image loader,
a typed dynamic component, and font calls with and without CSS variables. Five
focused Haxe failures prove missing Link href, missing Image alt, Form
`prefetch: true`, an unknown Script strategy, and a wrong Inter axis fail before
generation. A separate emitted-TSX oracle proves Next/React reject missing
component props, a dynamic component without its required prop, an invalid
Script strategy, and a font variable without the `--` prefix. This split is
intentional: Haxe provides earlier ergonomic errors where it can, while the
canonical Next declarations independently protect the final output.

## Reviewed package-integration evidence

`npm run integrations:check` validates the schema-closed package inventory
against the installed npm tree and lockfile. It requires exact direct version
pins, SHA-512 package integrity, license and repository provenance, the public
declaration selected by the ESM import condition, declaration SHA-256, required
exports parsed through TypeScript, safe owned-source/evidence paths, canonical
ordering, and the no-broad-type policy in repository-owned Haxe and native
facades.

`npm run test:integrations` runs the same positive contract plus exact negative
controls for version drift, a removed public export, changed declaration bytes,
and a repository-escaping evidence path. Package-specific child fixtures extend
this shared lane with strict Haxe/TypeScript/Next and browser behavior rather
than reimplementing provenance checks. The normative ownership and upgrade
workflow is in [ADR 0007](adr/0007-reviewed-npm-package-integrations.md) and
[package-integrations.md](package-integrations.md).

## Maintained showcase matrix

`npm run test:showcases` turns the shared shadcn package and three example sites
into one release-facing lane. It validates authored source and exact pins,
requires the focused HXX positive/negative UI contract, compiles each site twice
and compares all durable generated bytes, then runs strict TypeScript and the
real Next production build. Expected prerendered routes are read from Next's
manifest rather than inferred from console output.

Each built site is then served with `next start` and driven in system Chrome at
1440 × 1000 and 390 × 844. The lane checks hydration, typed navigation,
generated metadata, custom not-found views, horizontal overflow, console/page
errors, failed requests, lazy images, the tide controls, blog navigation,
commerce filtering, cart quantity and total, and product navigation. Cleanup
removes only dedicated build roots and adapters listed in the validated
ownership manifest. The detailed site/surface map and TSX ownership rationale
are in [showcases.md](showcases.md).

## Request, cache, and Route Handler parity evidence

`npm run test:next-server` compiles a Route Handler-style Haxe consumer that
uses all 27 B05 P0 exports: the Web Request/Response contracts, every reviewed
`next/headers` and `next/cache` function, and the selected `next/server`
classes, callables, configuration types, and helpers. It then validates the
emitted TypeScript with version 6.0.2, `strict: true`, and
`skipLibCheck: false`. The fixture explicitly loads Next's published ambient
type declarations because importing `next/server` reaches compiled-module
stubs that Next documents for library-check-enabled consumers.

Output assertions require direct public imports from `next/headers`,
`next/cache`, and `next/server`; no repository-owned extern may become a local
runtime wrapper. The runner rejects `next/dist/**`, TypeScript `any`, and
machine-local paths across the emitted B05 boundary. It also locks Promise
returns for async request APIs, the safe `Request`/`Response` JSON projection,
typed `NextResponse.json` bodies, closed cache/path values, explicit mutable
cookie intent, discriminated proxy matchers, and native URL/user-agent calls.

Six Haxe failures reject a raw string cache profile, the obsolete one-argument
`revalidateTag` call, mutation through read-only headers or cookies, a host
matcher without its required value, and assigning untrusted request JSON to a
string. Eight strict TypeScript failures independently reject invalid Next
arguments and proxy results. A deliberate negative control compiles the same
unchecked JSON claim against upstream `NextRequest` alone: it succeeds because
the DOM declaration still returns `Promise<any>`. The paired safe projection
fails on `unknown`, demonstrating why B05 needed the Haxe-side correction
without changing the Next runtime.

## Semantic codec evidence

`npm run test:codecs` compiles the same exact JSON, native form, and URL query
decoders through the TypeScript and classic JavaScript genes-ts profiles. The
TypeScript lane uses compiler 6.0.2 with `strict: true` and
`skipLibCheck: false`; its generated success response must retain the complete
anonymous body shape instead of widening to an opaque response.

The Node lane executes native `Request`, `FormData`, and `URLSearchParams`
behavior. Positive controls decode a closed todo body, form Boolean, both
signed 32-bit endpoints, and repeated tags. Eight malformed controls require
typed issue codes and paths for invalid JSON syntax, a wrong JSON field type,
a missing JSON field, an extra JSON field, an unparseable form request, a
duplicate scalar form field, an extra query field, and integer overflow. Two
focused compile-fail builds prove an `Unknown` cannot be
returned as a domain string and a function cannot pass the checked response
encoder.

The runner scans emitted semantic modules for TypeScript `any`,
`Register.unsafeCast`, TypeScript suppression comments, private `next/dist/**`
imports, and machine-local paths, then deletes temporary output on success or
failure. The normative API and the reason it was introduced are documented in
[codecs.md](codecs.md).

## Positive and negative Haxe fixtures

[tests/haxe/fixtures.json](../tests/haxe/fixtures.json) is validated against a
closed JSON Schema. A positive entry names a repository-relative `.hxml` build
that must exit successfully. A negative entry additionally records the exact
nonzero exit, stable `NXHX-*` diagnostic code, source file, line, character
range, and message. The negative runner rejects a changed location, a changed
code, an extra NextJsHx diagnostic, and an unexpected success.

Keep negative fixtures focused on one contract. When adding one:

1. Put its Haxe input and build file under `tests/negative/<case>/`.
2. Emit one actionable diagnostic with a stable category code.
3. Add the exact expected diagnostic to `tests/haxe/fixtures.json`.
4. Run `npm run test:haxe:negative` and review the failure before accepting any
   expectation change.

## Adapter-plan evidence

`npm run test:adapter-plan` produces the schema-v1 plan from real typed Haxe
declarations without generating or executing application JavaScript. Forward
and reverse registration orders must produce identical bytes, and the result
must validate against
[schemas/adapter-plan.schema.json](../schemas/adapter-plan.schema.json) and the
reviewed snapshot. The fixture also checks repository-relative type, field, and
metadata ranges.

The duplicate-target case starts with sentinel plan bytes. Compilation must
fail with one exact `NXHX-PLAN-DUPLICATE-0001` diagnostic at the canonical
conflicting source range while leaving that sentinel unchanged. This proves
complete plan validation precedes plan publication; it does not grant
permission to write an App Router target.

## Route-pattern evidence

`npm run test:routes` parses root, static, dynamic, catch-all, optional
catch-all, String-backed abstract, codec-backed domain, grouped, parallel, and
all four interception-depth routes from real typed Haxe declarations. Forward
and reverse registration orders must produce the same canonical topology model
and match
[route-patterns-v1.json](../tests/snapshots/route-patterns-v1.json). The builds
use `--no-output`, and the runner rejects both application JavaScript and an
absolute compiler-host path in the result.

The negative matrix compiles one failure at a time and compares the exact
source file, line, character or line range, stable diagnostic code, and
message. It covers unsafe paths; malformed groups, slots, and interception
markers; insufficient interception depth; duplicate or misplaced params;
missing and extra fields; every wrong cardinality; optional fields; and invalid
or missing codecs. The fixture classpath includes the installed genes-ts source
directly so optional catch-all evidence checks the actual
`genes.ts.Undefinable<Array<String>>` type without activating runtime code
generation. The normative contract is documented in
[route-patterns.md](route-patterns.md).

## Page and layout declaration evidence

`npm run test:page-layouts` installs the global declaration macro before
typing application classes. Its positive matrix covers root, dynamic, grouped,
parallel, and intercepted pages; root, nested, and typed parallel-slot layouts;
synchronous and Promise element results; Promise-shaped params/search params;
React-node children/slots; and canonical injected page hrefs. The
schema-validated snapshot locks all four exact
source ranges, extensionless implementation imports, convention targets, and
route-literal `PageProps`/`LayoutProps` signatures while proving render
business logic never enters the plan.

A second genes-ts lane inspects exact `Route<Pattern>` href projections, proves
inline callers retain no server page import, and passes strict TypeScript with
`skipLibCheck: false`. Eleven isolated macro controls lock missing render,
structural props lookalikes, unvalidated query input, dynamic-param mismatch,
wrong render output, an unreviewed public field, and unmarked, mutable,
optional, or wrongly typed layout slots. A direct search-parameter mutation is
the twelfth Haxe failure.
Failed typing must leave no plan bytes, including for
ordinary Haxe errors after plan preparation. The normative contract and
positive/negative examples are in [pages-and-layouts.md](pages-and-layouts.md).

## Metadata, static-param, and segment-config evidence

`npm run test:metadata-segment` extends the page/layout contract with three
positive declarations: static page metadata, Promise-returning generated page
metadata and static params, and synchronous layout metadata/static params. The
schema-validated snapshot locks exact `Metadata` and `ResolvingMetadata`
imports, route-aware props, static-param array signatures, and tagged literal
config. A genes-ts build proves the compile-time `SegmentConfig` marker and
`segment` field are erased before runtime output.

The runner builds the host CLI, renders the real adapters, and requires direct
literal exports with no assertion or broad type. Strict TypeScript with
`skipLibCheck: false` independently checks the complete implementation/adapter
boundary. Fourteen isolated failures cover wrong or conflicting metadata,
structural props, wrong parent metadata, static-param route mismatch or static
route use, experimental runtime, meaningless `true` revalidation, invalid
duration/regions/field names, runtime config expressions, and foreign qualified
lookalikes for the config marker or runtime values.

The stable fixture is the final oracle: Next 16.2.12's plugin and production
build accept the direct config, prerender two Haxe-generated product slugs, emit
static and generated titles, and return 404 for a slug excluded by
`dynamicParams: false`. The normative authoring contract is in
[metadata-and-segment-config.md](metadata-and-segment-config.md).

## Route Handler declaration evidence

`npm run test:route-handlers` installs the global declaration macro before
typing application classes and produces a schema-v1 adapter plan with no
application output. Its reviewed snapshot requires one
`api/echo/[id]/route.ts` intent, a derived relative genes-ts import, a public
`next/server` request type import, and canonical DELETE, GET, and POST exports.
Direct responses retain a direct `globalThis.Response` signature; async Haxe
methods retain `Promise<globalThis.Response>`. Every export independently uses
Next's `RouteContext<"/api/echo/[id]">` route literal, and the runner rejects
broad TypeScript boundary types or a compiler-host path.

Five isolated negative modules lock exact source ranges, codes, and messages
for a duplicate GET export, unsupported TRACE annotation, a structural context
substitute, route params missing the dynamic `id`, and a String return. Each
failure must leave the rejected plan absent. The stable fixture then proves the
same API beyond snapshots: genes-ts emits the implementation, the CLI renders
and publishes the adapter, strict Next/TypeScript checks it, Turbopack builds
it, and a production server executes GET, POST, and DELETE. The normative
authoring contract and positive/negative examples are in
[route-handlers.md](route-handlers.md).

## Loading, error, not-found, and slot-default declaration evidence

`npm run test:special-files` installs the special-file declaration macro and
types Haxe-owned loading, error, not-found, and parallel-slot default
components without emitting application JavaScript. Its schema-v1 snapshot
locks exact convention targets,
extensionless genes-ts imports, one default export per file, server-owned
loading/not-found modes, and the error boundary's first-position `"use
client"` directive. The error signature remains exactly
`Error & { digest?: string }` plus `reset: () => void`; every component imports
React's module-owned JSX type and contain no broad TypeScript boundary.

The generated-TSX lane proves semantic `ErrorProps` exposes the Error message
and a directly usable reset callback, permits async loading/default components,
and passes strict TypeScript with `skipLibCheck: false`. Nine isolated macro
controls lock missing render, unexpected loading/not-found arguments, a
structural error-props lookalike with a wrong reset signature, an async client
error, a non-element result, a structural default-props lookalike, a default
outside a slot, and wrong inherited default params. A direct one-argument reset
call supplies the tenth Haxe control. Every failure emits one exact diagnostic
and no rejected plan bytes.

The stable fixture goes beyond plan and source snapshots. It transactionally
publishes all twelve convention adapters, completes Next 16.2.12 typegen, strict
TypeScript, and a Turbopack production build, then starts `next start`. Raw HTTP
proves static/generated metadata and generated params, that the Haxe loading
fallback precedes resolved bytes, and that both not-found paths retain status
404. System Chrome, controlled through pinned browser-core code without a
downloaded browser binary, proves a typed intercepted route preserves its feed
and opens a Haxe dialog on soft navigation, reloads to the canonical Haxe photo
page with the Haxe slot default, visibly hydrates the Haxe 404, and sends a
client render failure through the Haxe error/reset contract. The normative
special-file contract and examples are in [special-files.md](special-files.md).

## Request proxy declaration evidence

`npm run test:proxy` installs the root proxy declaration macro, snapshots one
canonical `proxy.ts` intent with bytewise-sorted matcher literals, and compiles
the retained genes-ts implementation under strict TypeScript with library
checks enabled. Seven isolated failures lock missing functions, wrong request
and return types, matcher expressions and duplicates, unreviewed public fields,
and competing boundary annotations. Each rejected declaration leaves no plan.

The CLI corpus independently renders both supported roots, rejects custom
placement, permits only the exact root convention file outside the App Router
allowlist, carries that authority through the closed recovery journal, and
preserves an existing native proxy. The stable fixture then lets Next 16.2.12
type-check and build the adapter and verifies a Haxe-authored response header on
a matcher-selected production request. The normative contract and positive and
negative examples are in [proxy.md](proxy.md).

## Production todo-app evidence

`npm run test:example:todoapp` builds and starts the maintained
`examples/todoapp-next` vertical slice. The source gate verifies exact Next,
React, TypeScript, Haxe, and config identities; parses the fixed five-column TSV
seed independently; checks deterministic IDs and state; and rejects broad or
unchecked Haxe escapes in all application modules.

The build gate creates an owner-only ignored runtime state file, invokes the
real `nextjshx build -- --turbopack` workflow, compiles the source-owned shadcn
theme, and requires fourteen exact manifest-owned adapters for actions, five
Client Components, the document layout, root list, dynamic detail, error,
loading, not-found, one typed Route Handler, and one shared cached-function
file. It inspects the
emitted application modules and adapters for broad TypeScript types, unsafe
compiler casts, assertions, suppressions, and private Next imports. The
generated list must retain a URL-encoded ``Route<`/todos/${string}`>`` value;
cached consumers must import the generated function ref instead of its raw
implementation; and the detail adapter must retain exact params, metadata, and
static-param contracts without Cache-Components-incompatible segment exports.
Next typegen, strict TypeScript, and the production build remain independent
final verifiers.

Before `next start`, the smoke gate replaces one seed record with another valid
state file using the same IDs. Raw HTTP proves the root and detail routes reopen
those shared bytes, calculate the deterministic count, emit typed links, and
produce generated metadata. The `todos/loading.tsx` boundary means Next commits
the streamed not-found document as HTTP 200; the test therefore requires the
Haxe not-found payload, Next's `robots=noindex`, and its 404 control-flow marker
instead of asserting a non-streamed status. System Chrome first submits invalid
input and requires a typed `form.title` issue without persistence changes. It
then creates a record, follows its dynamic typed detail link, toggles an
existing record, deletes the created record, and checks the TSV bytes after
every successful action. Finally it clicks the original typed detail/back
links, hydrates the custom not-found DOM, and rejects unexpected page, console,
or network errors. Before the form flow, exact HTTP checks require a typed GET
projection with known header/cookie values, an exact malformed-JSON 400 that
does not alter bytes, and a valid 201 mutation. Because the list cache is
primed before that write, the created row appearing after reload proves the
Route Handler's immediate `revalidateTag`; subsequent action-driven list
changes prove `updateTag`. This preserves Next's runtime behavior while proving
the Haxe layer improves route, codec, cache, and mutation authoring without a
parallel runtime.

`npm run test:example:todoapp:e2e` is the separate browser layer. Pinned
`@playwright/test` 1.61.1 runs fourteen tests with `fullyParallel: false`, one
worker, and zero retries. Every test creates a lowercase run ID, an owner-only
`.nextjshx/runs/<id>` directory and TSV, a run-scoped cache key/tag, a fresh
loopback port, and a new `next start` process, then removes only that run's
state. This isolates both persistence and Next Cache Components data instead of
assuming a clean result because the file alone was replaced.

The navigation journey uses a bounded server delay to make the actual Haxe
`todos/loading.tsx` observable before the detail page, then verifies typed back
navigation and the streamed Haxe not-found view. Four sorting journeys exercise
desktop pointer input, keyboard input, mobile pointer input, and board-lane
movement. A separate empty-ledger journey removes every persisted record and
requires useful live List and Board empty states, zeroed planning values, and
header-only valid TSV bytes. Two URL-state journeys verify typed discovery and
selection across reload and browser history. The planning journey requires the Recharts SVG,
keyboard focus, description, current-lens summary, and always-visible semantic
table to agree before and after priority/search changes, then checks the same
surface at 390 × 844 without horizontal overflow. The command-center journey
covers its visible
trigger, platform shortcut, dialog semantics, grouped commands, Todo-aware
navigation, create focus, responsive layout, Escape dismissal, and focus
return. The API journey sends malformed bytes, locks the typed 400/no-mutation
result, and proves a primed cached list changes after the next visible render.
The action journey covers rejected input, create, a newly created detail route,
toggle, and delete. The recovery journey triggers one named Haxe Client
Component fault, observes the typed Haxe `error.tsx`, and invokes Next's exact
reset callback after the deliberately bounded fault expires. The optimistic
recovery journey lets each real create, toggle, delete, and reorder Server
Action commit while Playwright replaces its browser response with HTTP 503. It
observes pending UI, rollback to server props, offline-disabled retry,
reconnect, replay-safe success, final persisted order, and one unique receipt
per operation. The control lives entirely in Playwright routing; no fault
switch or test credential enters the production application.

Diagnostics are fixture-level, so early assertion failures cannot skip them.
Every page error, console error, hydration warning, request failure, and
unexpected HTTP failure is blocking. The recovery marker and Next's exact
aborted RSC requests for intentionally abandoned routes are classified by
marker, method, error, query kind, and pathname; no general error regex is
ignored. The dedicated `todoapp-production-e2e` CI job builds and runs this
against the pinned production server on every push and pull request.

## Typed route-href evidence

`npm run test:route-hrefs` exercises generated-style Haxe companions rather
than exposing the internal path-string macro as an application API. Named
non-generic `@:structInit` params classes give editors and compiler diagnostics
the exact per-route call shape while preserving concise object syntax. The
companions inline at every server and client call site, so their output contains
neither a route-helper class nor a page-implementation import.

The positive matrix covers root, static, String-backed, codec-backed,
multi-parameter, catch-all, and optional catch-all paths, then required,
optional, repeated, renamed, domain-codec, and zero-pair query forms. It asserts
native TypeScript templates and `URLSearchParams`, classic-JavaScript runtime
parity, per-segment and query encoding, canonical query-key order, absent
compiler markers/assertions, and zero emitted helper modules when no runtime
codec is needed. Fourteen Haxe compile-fail calls prove the six pathname errors
plus missing, extra, wrong, unsupported, malformed-codec, forged-string, and
mutable-field query errors plus a dynamic-path arity error. A fifteenth
strict-TypeScript control proves a well-typed
`Route<"/not-in-next-route-graph">` claim still fails when Next did not
discover that URL.

Finally, the runner invokes pinned Next `typegen` with `typedRoutes: true` and
checks all generated Haxe output under strict TypeScript with
`skipLibCheck: false`. Its App Router tree includes one native route beneath a
route group and proves Next exposes the normalized `/catalog/[sku]` URL beside
all Haxe patterns through tracked concrete `Route<literal>` assignments rather
than parsing generated `.next` declarations. The CLI command suite
independently inventories canonical, grouped, parallel, and intercepted route
roles, preserves native ownership, ignores private and non-convention files,
validates exact owner-only temporary parity-probe bytes, rejects duplicate or
orphan view ownership, and requires one real default convention per named slot.

The optional catch-all absent form currently includes a trailing slash because
Next 16.2.12's generated `Route<T>` contract accepts `/archive/` but omits the
equivalent bare `/archive`; `nxhx-ax5` owns the framework-neutral upstream
investigation. The normative downstream contract is documented in
[route-hrefs.md](route-hrefs.md), and the closed outbound query contract is in
[route-queries.md](route-queries.md).

## Configuration and discovery evidence

`npm run test:config-discovery` strictly compiles the host-native TypeScript
tooling before exercising it. The positive matrix covers the closed schema-v1
model, a single npm package, app and src/app detection before initialization,
and a pnpm monorepo whose application package is distinct from its workspace
root. It records declared package-manager and Next.js versions without running
package scripts.

The negative matrix rejects unknown root and nested keys, unknown config
versions, unsafe paths, filesystem-shaped package names, duplicate Haxe
defines, executable config text, ambiguous App Router roots, conflicting
package-manager evidence, and an App Router symlink that escapes the package.
Every failure asserts its stable `NXHX-CONFIG-*` code and actionable diagnostic
fields. The normative contract is documented in
[configuration.md](configuration.md).

## Generated-output ownership evidence

`npm run test:ownership-preflight` strictly compiles and runs the pure
filesystem preflight. It proves canonical manifest bytes and generation hashes,
classifies verified create/update/unchanged/remove states, and asserts that no
target or control file changes while planning.

Adversarial cases cover absolute and traversal paths, reserved configuration,
targets outside allowlisted roots, non-TypeScript outputs, case-equivalent
duplicates, unknown or inconsistent manifests, existing unowned files even
with matching bytes, modified and missing owned files, symlink targets,
symlinked parents, and symlinked output roots. Diagnostics assert stable
`NXHX-OWNERSHIP-*` codes, exact digest evidence where relevant, claiming Haxe
source context for collisions, and safe resolutions. The normative contract is
documented in
[generated-output-ownership.md](generated-output-ownership.md).

## Transactional publication and recovery evidence

`npm run test:publication` exercises the formatter, journal schema, exclusive
lock, atomic publisher, validation rollback, and recovery as one filesystem
contract. It injects an interruption after the prepared and publishing phases,
after every create/update/remove, after the manifest-last rename, after the
published phase, during every reverse rollback mutation, and after commit.

Every interrupted forward state must restore the exact previous adapters and
manifest unless a validator is deliberately supplied to commit an already
published state. Every interrupted rollback must resume to the same previous
state. The suite separately proves that formatter/syntax errors never touch a
live sentinel, unchanged files retain inode and nanosecond modification time,
failed post-publication typechecking restores prior bytes and modes, a
hand-edited unexpected digest blocks recovery without being overwritten,
concurrent publishers fail at the exclusive lock, and only a provably dead
same-host lock can be cleared. The normative protocol and diagnostic families
are documented in
[generated-output-publication.md](generated-output-publication.md).

## CLI workflow evidence

`npm run test:cli` strictly builds the command package and covers both the
closed adapter-plan parser/renderer and all six user-facing commands. The
positive generation corpus proves exact create/update/unchanged/remove
reporting, direct Haxe/Next/TypeScript process order, and no residual lock or
journal. Negative cases prove a blocked native target remains unowned, a Haxe failure leaves live bytes untouched, and a
post-publication validation failure restores exact prior adapters and manifest.

Typecheck and checked-route cases require the fresh rendered plan to match the
verified live tree before Next parity can be reported. The route matrix covers
root, dynamic, catch-all, and optional-catch-all cardinality. Doctor evidence
checks healthy and interrupted transactions plus an optional Next source oracle
at its exact version and commit. Separate tests reject unknown plan keys,
unsafe paths, non-canonical arrays, statement injection through a TypeScript
signature, `any`, and broad `unknown`; both successful and failing CLI paths
also assert stable JSON envelopes.

Production-build cases assert the full doctor → clean generation → publication
→ Next typegen → strict TypeScript → Next build → stale verification order.
They independently fail Haxe, native ownership, TypeScript, and Next; reject a
skipped Next type phase, plan drift, symlinked cleanup, trace upload, partial or
unknown flags, and conflicting bundlers; and prove reviewed ordinary flags
reach `next build`. The stable consumer fixture then runs that real command
against pinned Haxe, genes-ts, TypeScript, and Next packages. It verifies
byte-stable snapshots for the root layout, canonical and intercepted photo
pages, feed, slot default, `/haxe`, product, loading/error/not-found, and proxy
adapters plus the generated Route Handler. Production HTTP and browser checks
then prove the Haxe layout renders native and generated children, soft
navigation selects the intercepted modal, and reload selects the canonical
page plus slot default.

## Development-loop evidence

`npm run test:dev` first covers the event loop and process boundaries without
timing-dependent external tools: changes received during a compile collapse
into one serialized newest-state pass, identity events outrank source events,
failed runs do not poison later runs, exact and recursive watch inputs are
classified correctly, polling alone recovers both source and compiler-identity
edits when native events are unavailable, a reachable generated dependency
changes the affected adapter's implementation-graph digest while an unrelated
module does not, Next dev arguments remain byte-preserving and
allowlisted, and cleanup terminates one owned process group without touching an
unrelated child. Fake-runtime cases prove a Haxe failure never restarts Next,
an initial failure requires an exact last-good tree, a crashed owned compiler
server is replaced, and `SIGTERM` reaches only invocation-owned processes.

The same command then starts the real pinned Haxe, genes-ts, and Next toolchain
against the stable fixture and drives system Chrome with zero retries. A valid
Haxe Server Component edit must first appear in the exact generated TSX bytes
and then through native Fast Refresh. A deliberate
Haxe syntax error must stream its raw diagnostic while the browser and every
last-good generated byte remain unchanged. Fixing the source must report
recovery, prove the recovered generated bytes, and refresh the browser without
restarting Next. Restoration proves the original generated bytes and browser
state as a final rapid-edit control. The fixture is
restored before a bounded signal cleanup removes generated state and the
compiler/Next children.

## Generated snapshots

`npm run test:snapshots` compiles the pinned stable fixture from scratch and
compares the complete split genes-ts output tree with
`tests/snapshots/next-stable-generated/`. It checks missing, extra, and changed
files after normalizing only line endings and trailing whitespace.

To update intentionally:

```sh
npm run test:snapshots:update
git diff -- tests/snapshots
npm run test:snapshots
```

Snapshot updates are disabled in CI. Review the generated imports, exports,
directives, types, and manifest; never update snapshots merely to silence a
failure.

## Strict TypeScript and packed consumers

Fixture TypeScript configurations retain `strict: true`, `skipLibCheck: false`,
and `noEmitOnError: true` where emitting a consumer. Next build type errors are
not disabled. The package-shape harness performs `npm pack`, checks the exact
tarball allowlist and integrity, installs that local tarball into an isolated
consumer with lifecycle scripts disabled and npm in offline mode, runs strict
TypeScript, and executes the emitted ESM.

The current artifact is a deliberately tiny harness self-test. The release
packaging Bead will point the same clean-consumer flow at the real npm CLI and
Haxelib artifacts once those packages exist.

## Generic compiler-gap evidence

`npm run test:compiler-gaps` compiles the same framework-neutral Haxe source
through genes-ts TypeScript and classic JavaScript/declaration profiles. Strict
TypeScript consumers validate both. The runner records missing output shapes
as deliberate drift assertions, so adopting a new compiler commit requires an
explicit inventory review rather than silently changing the evidence.

The [compiler gap inventory](compiler-gap-inventory.md) records each reduced
input, desired TypeScript and JavaScript output, current output, workaround,
risk, priority, and owning Bead. Repro source must not contain downstream
framework names or paths.

## Compiler-upstream changes

If a fixture exposes a genes-ts compiler gap, first reduce it to a generic,
framework-neutral reproduction. Any compiler fix belongs in an isolated
worktree of `../genes`, must remain uncoupled from NextJsHx, and must pass the
complete genes-ts TypeScript and classic-JavaScript regression suites before a
pull request is opened. NextJsHx records the tested commit only after that
upstream change is available remotely.
