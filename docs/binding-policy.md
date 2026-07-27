# Public binding inventory

For application-facing guidance, direct examples for every P0 module, and the
raw/semantic escape-hatch decision rule, start with
[Bindings, semantic APIs, and interop](bindings-and-interop.md). This document
is the compatibility inventory and declaration-review contract.

NextJsHx binds a reviewed public surface, not every declaration file shipped in
the `next` package. The source of truth is
[config/next-public-entrypoints.json](../config/next-public-entrypoints.json),
and its deterministic, declaration-resolved form is
[surface/next-public-surface.json](../surface/next-public-surface.json).
Both contracts are schema-v1 and tied to Next 16.2.12 and TypeScript 6.0.2.

This inventory defines what the binding pipeline may expose. All reviewed
P0/P1 exports are now generated or curated with strict usage fixtures; the two
P2 `next/og` and `next/web-vitals` exports remain explicitly pending rather
than being presented as implemented coverage.

## Reviewed scope

The classification follows PRD section 10.1 exactly. Selection within a module
is intentionally narrower than every export Next happens to ship.

| Priority | Module | Selected public exports |
| --- | --- | --- |
| P0 | `next` | `NextConfig`, `Metadata`, `ResolvingMetadata`, `Viewport`, `ResolvingViewport` |
| P0 | `next/types` | `Route`, `ServerRuntime` |
| P0 | `next/link` | default component, `LinkProps`, `useLinkStatus` |
| P0 | `next/image` | default component, `getImageProps`, `ImageLoaderProps`, `ImageProps`, `StaticImageData` |
| P0 | `next/form` | default component, `FormProps` |
| P0 | `next/navigation` | documented App Router hooks, `ReadonlyURLSearchParams`, `RedirectType`, redirects, and not-found/error interrupts |
| P0 | `next/headers` | `cookies`, `draftMode`, `headers` |
| P0 | `next/cache` | stable cache/revalidation functions and the named `unstable_*` compatibility functions |
| P0 | `next/server` | request/response, proxy/middleware contracts, user-agent helpers, `URLPattern`, `after`, and `connection` |
| P0 | Web globals | the TypeScript DOM `Request` and `Response` interface/constructor pairs, projected as native `WebRequest`/`WebResponse` values with safe JSON decoding |
| P1 | `next/dynamic` | default loader, `DynamicOptions`, `Loader` |
| P1 | `next/script` | default component, `ScriptProps` |
| P1 | `next/font/google` | representative `Inter` and `Roboto` loaders; additional fonts require review |
| P1 | `next/font/local` | default loader |
| P2 | `next/og` | `ImageResponse` |
| P2 | `next/web-vitals` | `useReportWebVitals` |
| P2 | `next/compat/router` | nullable migration-only `useRouter` |

`next/router` remains an explicit P3 legacy exclusion. The
`next/experimental/*` family remains an explicit P3 experimental exclusion.
Neither can enter the supported surface through package discovery.

## Allowlist record

Each entrypoint records:

- its public module specifier or the pinned DOM global source;
- P0, P1, or P2 priority;
- a named declaration-resolution fixture;
- why this subset was selected;
- every supported export's kind and stability;
- its reviewed SHA-256 signature;
- the intended Haxe type/member;
- whether the product plans only a faithful raw façade or both raw and
  semantic Haxe ergonomics.

`raw-and-semantic` is an authoring intent, not permission to change Next's
meaning. The raw `nextjs.raw.*` layer stays faithful. A semantic `nextjs.*`
layer may use Haxe strengths such as closed abstracts, exact structural types,
typed builders, and compile-time validation, and may smooth a verified Next.js
UX shortcoming, but it must preserve native imports, runtime behavior, and
strict Next/TypeScript validation.

## Normalized signatures

The generator resolves every configured module through the pinned TypeScript
checker. Aliases are followed to their declaration symbols. Comments, source
positions, install paths, and line endings do not participate in a declaration
hash. Declaration syntax kind, declared name, and printer-normalized text do.
An export signature then hashes its public name, configured kind, and ordered
declaration hashes. This preserves overload order and merged DOM
interface/constructor shapes while allowing an unchanged declaration to move
between internal files without changing the public export hash.

The manifest records package-relative paths only. It must never contain an
absolute path or `node_modules`. Its final `surfaceHash` covers a recursively
key-sorted form of every field except the hash itself. Entrypoints, exports,
exclusions, internal origins, and reference lists are normalized bytewise, so
reordering the source arrays produces identical manifest bytes.

The schema-v1 signature is deliberately the selected symbol's declaration set,
not an automatically expanding graph of every referenced type. The declaration
ingestion Bead owns that dependency graph and drift classification. This keeps
the initial promise curated instead of allowing a transitive reference to
silently publish a new Haxe API.

## Public versus internal declarations

A public export such as `next/link`'s `LinkProps` may currently be declared in
`next/dist/client/link.d.ts`. The public promise is still `next/link` and the
recorded Haxe façade. Every selected declaration origin under `next/dist/**` is
also copied into the manifest's separate `internalSupportingDeclarations`
index with:

- `compatibilityPromise: false`;
- `runtimeImportAllowed: false`;
- the exact public module/export references it supports.

Future generated support types may live under `nextjs._internal.*` and remain
hidden from completion and application documentation. Semantic wrappers must
never runtime-import `next/dist/**`. If Next moves an internal declaration but
keeps its normalized public signature, user-facing Haxe names should remain
unchanged.

## Declaration ingestion and binding IR

The allowlist manifest is the compatibility input; the checked
[binding IR](../surface/next-binding-ir.json) is the generator input. Running
`npm run bindings:next:check` resolves every one of the 78 declaration nodes
behind the 68 reviewed exports from the exact installed packages. A node must
match its package-relative path, syntax kind, declared name, and declaration
hash before it can enter the IR. The output records Next 16.2.12, TypeScript
6.0.2, normalized declaration text, documentation hashes, type constructs,
Haxe ownership, fixture ownership, and generated-artifact digests.

This extra stage was needed because the public signature manifest answers
"which exports do we promise?" but not "which TypeScript constructs can the
Haxe generator translate safely?" While developing NextJsHx, the ingestion
pass found selected upstream `any` boundaries, legitimate `unknown` HTTP data,
and a closed `ServerRuntime` literal union. Treating all three as the same
dynamic type would erase useful Haxe guarantees. The binding IR therefore
makes the translation policy explicit before broader B03-B05 extern work.

The parser has a named allowlist of TypeScript type-node forms observed in the
reviewed declarations. An unimplemented form such as a mapped type fails with
the owning export, construct, and declaration path before any Haxe is emitted.
Support must be generalized in the parser and covered by a reduced fixture;
an unchecked fallback to `Dynamic`, `Any`, or a broad cast is not allowed.
Type-only `import("next/dist/...")` text may appear as declaration provenance
inside the IR, but it never authorizes a Haxe or JavaScript runtime import.

Every IR export has one of three honest implementation states:

- `generated`, with an exact strategy, output path, owner, and output digest;
- `curated`, with a signature-locked implementation group, reviewed Haxe
  source outputs, owner, strict fixture, and source digests;
- `pending`, with the owning follow-up that must implement and fixture it.

The B02 bootstrap intentionally generates only
[ServerRuntime.hx](../src/nextjs/raw/ServerRuntime.hx). It is mechanically
provable as three string literals plus `undefined`, so Haxe receives a closed
`ServerRuntimeValue` enum abstract wrapped in `genes.ts.Undefinable`. Recording
unimplemented exports as pending avoids presenting declaration inventory as
finished binding coverage. Both Haxe types carry exact genes-ts metadata, so
the generated TypeScript remains the literal union rather than widening to
`string | undefined`; a strict TypeScript fixture locks that cross-language
contract.

## Curated core and navigation bindings

B03 implements 20 reviewed exports across 14 Haxe source files and leaves the
remaining 47 exports pending for B04-B05. These bindings are curated because
their useful Haxe shape depends on API semantics—read-only behavior,
non-returning control flow, inference, and public-versus-internal type
boundaries—not merely on printing declaration syntax.

[config/next-binding-implementations.json](../config/next-binding-implementations.json)
is the closed implementation manifest. Each bytewise-sorted group records the
exact upstream export signature hashes, source outputs, B03 owner, strict
fixture, and why hand-shaped translation is needed. The binding pipeline hashes
the actual source bytes into the IR, rejects stale signatures or duplicate
ownership, and refuses `Dynamic` or a runtime `next/dist/**` import. A curated
source change is therefore classified as breaking drift and needs an exact
reviewed transition; `curated` never means unchecked.

The raw coverage is:

| Boundary | Haxe contract | Ergonomic or safety decision |
| --- | --- | --- |
| `NextConfig` | exact public `next.NextConfig` projection | keep the plugin-extensible object graph while replacing its reviewed `sassOptions` `any` boundary with `unknown` |
| `Metadata`, `ResolvingMetadata`, `Viewport`, `ResolvingViewport` | exact public root-type projections | preserve the complete upstream field graph without copying internal declarations or weakening it to `Dynamic`; strict TypeScript validates nested object literals |
| `Route<Unknown>` | exact public `Route<T>` projection | retain the raw string fallback; generated `RouteHref` companions remain the preferred application API for known routes |
| `useParams` | default string-keyed `RouteParams` or a target-inferred fixed Haxe record | let Haxe provide named fields while Next's public generic constraint independently validates the emitted record |
| `useRouter`, `usePathname`, selected segments | public-hook-derived types | expose stable router operations and nullable segment results without importing an internal interface |
| `useSearchParams` | read-only query API with precise iterators | omit inherited mutation methods that throw at runtime, turning a runtime trap into a Haxe compile error |
| redirects and error interrupts | `Never`, emitted exactly as TypeScript `never` | model control-flow interruption as closely as Haxe and genes-ts permit instead of falsely returning `Void` |
| `RedirectType` | closed `Push`/`Replace` enum abstract plus exact runtime `Navigation.RedirectType.push/replace` values | reject arbitrary strings in Haxe while preserving Next's real runtime export with no cast |
| `next/compat/router.useRouter` | nullable migration-only router | require the readiness/null check that mixed Pages/App Router applications need |

Every reviewed Hook in these bindings—including `next/link.useLinkStatus`—also
carries `@:next.hook`. That metadata changes no runtime import or public
TypeScript signature; it lets the Client Component pass identify the resolved
field through Haxe import aliases and report invalid React control flow without
treating arbitrary `use*` methods as Hooks. The exact curated-source digest
changes are recorded in the accepted transition chain and remain guarded by
the existing navigation/component parity fixtures.

Two intentional narrowings address verified Next 16.2.12 UX shortcomings while
preserving runtime behavior. `ReadonlyURLSearchParams` does not expose
`append`, `delete`, `set`, or `sort`, because Next's read-only wrapper rejects
those operations at runtime. `AppRouterInstance.prefetch` exposes the stable
one-argument form because its optional second parameter refers to a non-public
prefetch enum; publishing that internal declaration would make a public Haxe
contract depend on `next/dist/**`. When Next exposes a stable public option
type, normal surface drift review can widen the binding.

Large open object graphs such as `Metadata`, `Viewport`, and `NextConfig` use an
empty structural Haxe representation paired with an exact `@:ts.type`
projection. That is a raw escape hatch, not a claim of complete Haxe-side field
completion: it permits ordinary anonymous object literals without `Dynamic`,
while strict generated-TypeScript validation rejects unsupported keys and
values. Later semantic façades may add discoverable builders and closed domain
types without narrowing this faithful raw surface.

## Curated components, lazy loading, scripts, and fonts

B04 implements the next 18 reviewed exports across 20 Haxe source files. At
that checkpoint, B03-B04 accounted for 38 curated exports and 34 source
outputs; B05 subsequently implements the P0 server surface. B04 was needed
while building NextJsHx component authoring: the declaration inventory alone
did not provide Haxe-visible required props or literal choices, and the planned
`nextjs.raw.Dynamic` and `nextjs.raw.dynamic.*` names cannot be declared because
`Dynamic` and `dynamic` are Haxe language names.

| Boundary | Haxe contract | Ergonomic or safety decision |
| --- | --- | --- |
| `next/link` | default `Link`, generic `LinkProps<RouteInfer>`, and `useLinkStatus` | require href in Haxe and let generated route-href types replace the raw String parameter without changing Next runtime behavior |
| `next/image` | default `Image`, required `src`/`alt`, numeric-string dimensions, static data, loader input, and `getImageProps` | expose closed loading and placeholder literals while retaining the exact public ImageProps projection as the final oracle |
| `next/form` | default `Form` and required route-or-function action | type callbacks with the current `globalThis.FormData` projection, expose only false as an explicit prefetch override, and omit `method`, `encType`, and `target`, matching Next's documented disallowed-prop behavior |
| `next/dynamic` | `DynamicComponent.load`, `nextjs.raw.lazy.Loader`, and stable app-authored options | avoid reserved Haxe names and omit the build-generated loader-map/`loadableGenerated` seam whose upstream declaration contains internal `any` values |
| `next/script` | default `Script`, closed strategy, and typed callbacks | replace the two upstream `any` event payloads with explicit `genes.ts.Unknown` values that application code must narrow |
| `next/font/google` | lower-camel `Google.inter`/`Google.roboto`, closed weights, styles, subsets, axes, and variable-aware overloads | follow Haxe naming conventions while genes-ts still emits the exact `Inter` and `Roboto` named imports |
| `next/font/local` | `Local.load`, required single/multi-file sources, closed fallback choice, declarations, and variable-aware overload | preserve the default import and return the variable-bearing shape when a `--*` CSS variable is supplied |

All component and font runtime values remain externs. The emitted TSX imports
the public Next modules directly, so these ergonomics add no wrapper component,
helper JavaScript, or alternate runtime. The dynamic options intentionally omit
`loadableGenerated` and loader maps: those are build-generated seams rather
than stable application inputs, and publishing their `any` values would weaken
the Haxe layer for no usable authoring benefit.

### JSX-safe semantic component values

Use `nextjs.components.NextLink`, `NextImage`, `NextForm`, and `NextScript` as
tags in application HXX. Keep using the exact prop types in
`nextjs.raw.components.*`; the semantic values deliberately reuse those types
and the same public `next/*` default imports.

This naming layer was added after a real landing-page production build exposed
an HXX authoring collision: a raw extern named `Link`, when referenced only as
`<Link>`, could be lowered as the intrinsic HTML `<link>` element. React then
failed while prerendering because that intrinsic element must be self-closing.
`Image`, `Form`, and `Script` overlap intrinsic names in the same way. The
distinct `Next*` Haxe names keep component identity explicit and discoverable;
they are extern aliases, not wrappers, so runtime behavior, imports, and Next's
TypeScript validation are unchanged.

The faithful raw component values remain public for exact low-level interop and
non-HXX value use. Prefer the semantic names for inline markup because they
remove the HTML-name ambiguity while preserving an immediate path back to the
raw props, helpers, and runtime contract.

Positive component example:

```haxe
final link:LinkProps<String> = {
  href: "/products",
  prefetch: LinkPrefetchMode.Auto
};
final image:ImageProps = {
  src: "/hero.png",
  alt: "Product hero",
  width: 640,
  height: "360",
  placeholder: ImagePlaceholder.Blur
};

return <main>
  <NextLink {...link}>Products</NextLink>
  <NextImage {...image} />
</main>;
```

This emits `import NextLink from "next/link"` and
`import NextImage from "next/image"`; Next's own declarations check the
resulting JSX. Google and local font calls similarly emit direct named/default
imports; supplying a CSS variable returns a type with the required `variable`
field.

Negative controls: `{prefetch: true}` is not a valid `FormProps` value, an
unknown Script strategy and Inter axis fail in Haxe, and Link/Image object
literals without `href`/`alt` fail before TypeScript generation. Constraints
that cannot be completely encoded in Haxe remain deliberate strict-TypeScript
failures: JSX without required Next props, a typed dynamic component missing a
required prop, and `variable: "font-inter"` without the `--` prefix are all
rejected by the final oracle. Without this dual contract, obvious prop mistakes
would be delayed and the internal dynamic-loader `any` seam could leak into
application APIs.

## Curated Web, request, cache, and server bindings

B05 implements all 27 reviewed P0 exports across 21 Haxe source files. Together
with B03-B04 and the generated `ServerRuntime`, the checked IR now records 65
curated exports, one generated export, 55 curated source outputs, and two
explicitly pending P2 exports. This work was needed while building the first
Route Handler-shaped consumer: Next's runtime APIs are direct and useful, but
their declaration shapes do not by themselves express cookie mutation context
in Haxe, and Haxe 4.3.7's Web externs still expose JSON as `Dynamic`.

| Boundary | Haxe contract | Ergonomic or safety decision |
| --- | --- | --- |
| Web `Request` / `Response` | native `WebRequest` and `WebResponse` projections | retain the platform constructors and structural compatibility while changing only `json()` from inherited `Dynamic`/TypeScript `any` to `genes.ts.Unknown` |
| `next/headers` | Promise-returning `Headers.cookies`, `headers`, and `draftMode` | omit throwing header mutators and make cookie reads mutation-free by default; `Headers.mutableCookies()` is an explicit Haxe alias of the same public `cookies` export for valid write contexts |
| `next/cache` | all ten selected public functions | provide named built-in lifetime profiles, explicit custom profiles, closed path scopes, false-only legacy revalidation, and Next 16's required tag profile without adding a runtime helper; semantic directive placement and generated refs are layered separately in [Cache Components](cache-components.md) |
| `NextRequest` | direct named import extending the safe Web request view | expose request cookies and `nextUrl`; keep body JSON untrusted until a codec narrows it |
| `NextResponse` | direct named import plus typed `json` result | preserve unknown for external responses, but retain the exact body type for a response created locally with `NextResponse.json(value)` |
| proxy/middleware | exact public callable/config projections with named matcher records | distinguish key conditions from host conditions so missing `key`/`value` fields fail in Haxe; use explicit `null` for the no-response continuation case |
| `NextFetchEvent`, `URLPattern`, user agent, `after`, `connection` | direct public imports and typed supporting records | preserve request-lifetime Promises, URL match groups, parsed UA fields, and callback result inference without `next/dist/**` imports |

Positive Route Handler example:

```haxe
@:async
static function post(request:NextRequest):Promise<WebResponse> {
  final incoming = await(Headers.cookies());
  final session = incoming.get("session");

  final outgoing = await(Headers.mutableCookies());
  outgoing.set("theme", "dark", {httpOnly: true});

  Cache.revalidateTag("todos", CacheLifeProfile.Max);
  return NextResponse.json({ok: true, path: request.nextUrl.pathname});
}
```

The two cookie calls emit the same named `cookies` import. Their distinct Haxe
result views make mutation intent visible without wrapping or changing the
runtime function. Built-in cache profiles are discoverable; an application
profile is written explicitly as `CacheLifeProfile.custom("inventory")` rather
than silently accepting every raw string.

Negative controls show both the earlier Haxe errors and the upstream gap they
address. `Headers.cookies()` has no `set`, a raw `"minutes"` value is not a
`CacheLifeProfile`, `revalidateTag("todos")` is missing Next 16's required
profile, and `Promise<String>` cannot be returned from `request.json()` because
the result is `Promise<genes.ts.Unknown>`. In contrast, a strict TypeScript
control using unmodified `next/server.NextRequest` accepts the unchecked JSON
claim because it inherits the DOM `Promise<any>` declaration. The B05 fixture
compiles that control, then proves the safe projection rejects it. Runtime
semantics remain identical; application code simply has to decode at the real
trust boundary.

## Reviewed safety overrides

[config/next-binding-overrides.json](../config/next-binding-overrides.json) is
a closed, signature-pinned exception set, not a general escape hatch. It is
limited by schema to eight safety entries and snapshot-tested at
`tests/snapshots/next-binding-overrides-v1.json`. Each entry states the exact
export signature, expected occurrence count, translation action, reason, and
owning Bead. A missing, unused, wrong-count, or signature-stale override fails
generation.

| Upstream boundary | Occurrences | Reviewed Haxe policy | Owner |
| --- | ---: | --- | --- |
| DOM `Response` | 1 `any` | map the JSON result to an explicit `genes.ts.Unknown` decode boundary | B05 |
| `next.NextConfig` | 1 `any` | map the open plugin/config value to `genes.ts.Unknown` | B03 |
| `next/form.FormProps` | 1 `any` | retain inherited React uncertainty as `genes.ts.Unknown` | B04 |
| `next/link.LinkProps` | 1 `any` | use `genes.ts.Unknown` until the typed-route façade narrows it | B04 |
| `next/link.default` | 2 `any` | apply the same route-generic policy to both callable sites | B04 |
| `next/server.NextResponse` | 4 `unknown` | preserve upstream `unknown` as `genes.ts.Unknown`; require application decoding | B05 |
| `next/types.Route` | 1 `any` | use `genes.ts.Unknown` in raw fallback; generated route literals own ergonomics | B03 |
| `next/script.ScriptProps` | 2 `any` | expose callback payloads through explicit `genes.ts.Unknown` values | B04 |

This policy does not claim that an unsafe upstream declaration becomes safe by
renaming it. It prevents uncertainty from flowing implicitly: raw bindings
must expose `genes.ts.Unknown`, and semantic APIs must narrow or decode it at a
named boundary. Once an owning binding supplies a more precise generic or
codec, its signature-pinned override can be removed through normal drift
review.

## Classified drift and review gate

The checked machine report is
[next-surface-drift.json](../surface/next-surface-drift.json); its human view is
[next-surface-drift.md](../surface/next-surface-drift.md). Both compare
canonical IR hashes and contain the exact Next version, owner, fixture, stable
diagnostic code, and required action for every change.

| Classification | Example | Drift command exit | Update policy |
| --- | --- | ---: | --- |
| compatible | unchanged signature moved between internal declaration files | 0 | review the move; never import the internal path |
| additive | a new reviewed export appears | 2 | assign and implement or explicitly defer its binding and fixture |
| behavioral review required | declaration docs, stability, or package version changes without a structural break | 2 | inspect upstream behavior and update guidance/fixtures |
| breaking | an export disappears, its signature changes, or its Haxe/safety contract changes | 1 | baseline update is blocked until the owning binding and fixture are fixed |
| unsupported construct | ingestion encounters a TypeScript form with no general translation rule | 1 | add generalized parser support and regression evidence first |

`npm run bindings:next:update` is disabled in CI. Outside the initial B02
bootstrap, it also refuses changed IR bytes unless
`acceptedTransitions` contains the exact old/new IR hashes, observed
classifications, owning Bead, and explanation. This makes an update an explicit
review record rather than a command for silencing CI. Transition entries form a
contiguous chain from the bootstrap hash to the checked IR; branches, gaps, and
reordered history fail closed. The checked stable lane blocks stale IR,
generated Haxe, and reports. The B06 compatibility runner layers real package
projection on top of the same classifier:

```sh
npm run drift:next:stable
npm run drift:next:upstream
```

The stable command validates the checked manifest and IR, then requires an
explicit projection from installed Next 16.2.12 to produce the same IR hash and
a clean report. The upstream command reads either the exact configured source
checkout or `NEXTJSHX_NEXT_PACKAGE_DIR`, writes a separate candidate surface
and JSON/Markdown reports under `.nextjshx/next-drift/`, and returns the
classifier exit code. It never calls either update mode or changes checked
baseline bytes. CI treats stable drift as blocking and the exact configured
canary as non-blocking early warning, publishing its Markdown in the workflow
summary.

Positive: if Next moves an unchanged public declaration from one private
`next/dist/**` file to another, its normalized signature stays equal. The
report classifies `NXHX-DRIFT-DECLARATION-MOVED` as compatible, names the
binding owner and fixture, and still forbids a runtime import of either private
path.

Negative: the observed `16.3.0-canary.87` package changes the reviewed
`NextConfig` and default Image component signatures. The report exits 1,
routes them to `nxhx-f34.3.3`/`p0-core-types` and
`nxhx-f34.3.4`/`p0-components`, and separately records package/documentation
review. Without candidate projection, those changes would remain invisible
until a later stable upgrade; blindly copying the candidate hashes would erase
the ownership and regression work required before support can move.

The one-time bootstrap review itself records the exact initial IR hash. Deleting
the checked IR cannot turn a later changed candidate back into an unreviewed
"initial" generation: a missing baseline is recreated only when the candidate
still matches that original B02 hash.

## Positive and negative examples

Positive: `next/link` explicitly lists its default component and `LinkProps`.
The resolver follows their public re-exports, verifies the reviewed signatures,
maps them to `nextjs.raw.components.Link*`, and records their current internal
declaration origins as non-promises. A later binding generator has an exact,
reviewable input.

Negative: Next also ships `next/router`, internal client loader helpers, many
hundreds of `next/dist/**` files, and hundreds of Google font functions. None is
added merely because it exists. Asking the inventory to resolve a missing
export, declaring a type as a function, changing the exact package version, or
changing a signature without review fails the gate. Without this allowlist, a
mechanical declaration crawler could accidentally turn private or legacy Next
implementation details into a public Haxe compatibility promise.

Generated-binding positive: Haxe can assign `ServerRuntimeValue.NodeJs` or
`ServerRuntimeValue.Edge` to `ServerRuntime`, and can spell host absence with
`Undefinable.absent()`. The emitted TypeScript contract remains
`"nodejs" | "experimental-edge" | "edge" | undefined`.

Generated-binding negative: assigning the arbitrary string `"deno"` to
`ServerRuntimeValue` fails Haxe compilation. Without the structured union
generator, a plain `String` binding would accept that typo and defer the
failure—or changed behavior—to Next at build or runtime.

Core/navigation positive: a consumer can ask Haxe to infer a fixed params
record from the assignment target, use closed router options, and preserve
non-returning control flow:

```haxe
typedef ProductParams = {
  final id:String;
  final slug:Array<String>;
}

final params:ProductParams = Navigation.useParams();
final router = Navigation.useRouter();
router.push("/products/" + params.id, {scroll: false});

function leave():Never {
  return Navigation.redirect("/login", RedirectType.Replace);
}
```

The emitted call is still checked against `next/navigation`, and `leave`
emits as TypeScript `never`. The same namespace also accepts the exact runtime
value `Navigation.RedirectType.replace` without an assertion.

Core/navigation negative: `Navigation.useSearchParams().set("page", "2")`
fails in Haxe because the read-only façade has no `set` field;
`Navigation.redirect("/login", "reload")` fails because `"reload"` is not a
`RedirectType`; and `{scroll: "yes"}` fails before generation because `scroll`
must be `Bool`. Without these Haxe contracts, the first call would reach a
known runtime trap and the other two errors would be delayed until TypeScript
or runtime. A deliberately invalid nested metadata title demonstrates the
opposite half of the dual oracle: raw Haxe accepts the open object, then strict
Next TypeScript rejects the unsupported nested key.

## Maintainer workflow

Normal validation is read-only:

```sh
npm run surface:next:check
npm run test:next-surface
npm run bindings:next:check
npm run test:next-bindings
npm run test:next-core-navigation
npm run test:next-components
```

When the pinned package changes or a reviewed export is added, first inspect the
upstream declarations and update the selection rationale, kind, stability,
Haxe mapping, and fixture. Render and review the public surface, then update its
checked manifest. Set `reviewedSurfaceHash` to the reviewed new surface hash,
render a candidate binding IR, and classify it against the current IR:

```sh
npm run surface:next:update
npm run test:next-surface
node scripts/bindings/sync-next-bindings.mjs render --artifact ir > candidate-binding-ir.json
node scripts/bindings/sync-next-bindings.mjs drift --candidate candidate-binding-ir.json
```

Update the owning bindings, fixtures, implementation manifest, override
snapshot, and documentation.
Only after the report is correct, add the exact old/new hashes and complete
classification set to `acceptedTransitions`, with the owning Bead and why the
change is needed. Then refresh and validate the checked artifacts:

```sh
npm run bindings:next:update
git diff -- config/ surface/ src/nextjs/raw tests/snapshots/next-binding-overrides-v1.json
npm run test:next-bindings
npm run test:next-core-navigation
npm run test:next-components
rm -f candidate-binding-ir.json
```

The update command is disabled in CI. It updates hashes and the manifest; it
does not decide whether drift is acceptable. Review every changed public
signature and internal origin, explain why the change is needed, and keep
additive exports out until they are explicitly allowlisted. The pre-commit hook
checks the generated manifest and binding IR. The baseline harness exercises
deterministic positive generation; a closed-literal Haxe success and arbitrary
string failure; unsupported-construct rejection; exact override snapshots; and
compatible, additive, behavioral, and breaking drift reports in addition to
the missing-export, wrong-kind, wrong-version, signature-drift, and
missing-fixture inventory failures.
