# genes-ts compiler gap inventory

This inventory reduces the compiler-facing seams exposed by the stable fixture
to ordinary Haxe-to-TypeScript/JavaScript contracts. The repro source contains
no Next.js, React, route, adapter, or project-specific names.

The evidence is pinned to genes-ts `1.38.2` at commit
`f0ffa29e6d49fe81541977c6a3aae6b80000cec6`, Haxe `4.3.7`, and both supported
genes output profiles. Run it with:

```sh
npm run test:compiler-gaps
```

## Prioritized result

| ID | Priority | Finding | Disposition |
| --- | --- | --- | --- |
| `GENES-GAP-DIR-001` | P1 | Module directive prologues were not expressible at the original baseline. | Resolved generically by merged genes-ts PR #1; the pinned compiler proves identical directive-first output in both profiles. |
| `GENES-GAP-DCE-001` | P1 | Authored TS callers are invisible to Haxe DCE, but genes-ts already has narrow application and library policies. | Adopt and prove the existing policies in `nxhx-f34.2.4` (G04); no new compiler primitive is justified. |
| `GENES-GAP-EXP-001` | P2 | Named module/root exports exist; arbitrary default-export selection does not. | Adapter-only decision accepted by `nxhx-f34.2.3` (G03); convention exports remain manifest-owned. |
| `GENES-CAP-JSX-001` | — | Module-scoped JSX type imports already work through `genes.ts.jsx_import_source`. | Keep the pinned define and strict TSX fixture; no compiler issue. |
| `GENES-CAP-TEMPLATE-001` | — | Authored typed string templates preserve their template-literal shape in TypeScript and runtime order in classic JavaScript. | Provided by genes-ts PR #2 at the pinned green commit; route hrefs use the generic API without framework behavior in the compiler. |
| `GENES-CAP-CALL-TYPE-001` | — | Haxe can erase a closed primitive-backed abstract before a generic extern call reaches TypeScript emission. | genes-ts PR #22 adds a direct-extern, declaration-opted-in, compile-time witness that preserves the closed type without a runtime helper or framework knowledge. |
| `GENES-CAP-CALL-IDENTITY-001` | — | Haxe can relocate an inner generic call or give it the same macro span as an unrelated fluent outer call. | Stacked genes-ts PR #35 carries a deterministic registration identity through the typed tree, verifies the exact extern target, and erases the carrier in both output profiles. |
| `GENES-CAP-ENUM-HIGHER-ORDER-001` | — | Haxe can erase an enum-abstract leaf nested in callbacks, arrays, aliases, anonymous structures, or generic applications before TypeScript emission. | Stacked genes-ts PR #37 captures only explicitly observed pre-erasure source types, recursively restores their closed leaves, and leaves unrelated widened paths conservative. |
| `GENES-CAP-LOCAL-CONST-001` | — | Initialized Haxe locals with no rebinding were emitted as mutable `let` declarations. | genes-ts PR #46 derives one complete typed-tree write inventory and emits canonical `const` in TypeScript, TSX, and classic ES2015 output while keeping uncertain or mutable bindings as `let`. |

## `GENES-CAP-LOCAL-CONST-001`: immutable local declarations

Haxe 4.3.7 does not expose the source `final` flag through the public custom
generator `TVar` API. The generalized compiler fix therefore proves the
stronger output property: an initialized local uses `const` when no assignment,
assignment operator, increment, or decrement rebinds that exact typed local
anywhere in the retained module, including nested closures.

NextJsHx exercises this with Haxe-authored React state tuples, semantic
dependency snapshots, typed route/query temporaries, JSX children, and Server
Function authorization values. Direct and captured reassignment,
initializer-free declarations, and locals passed through opaque
`js.Syntax.code`/`__js__` placeholders remain `let`. Updating array or object
contents does not rebind the local, so those bindings can still be `const`.
The pinned compiler's complete local and hosted matrices are green, and the
downstream strict Next, React lint, runtime, browser, snapshot, and package
checks protect the integration.

## `GENES-CAP-CALL-TYPE-001`: pre-erasure generic call types

The reduced compiler fixture uses a package-neutral `CellPhase` enum abstract
and generic `makeCell` extern. The unassisted typed node retains only the
`String` backing type, which previously produced
`makeCell<string>("pending")`. The pinned generalized capability lets a typed
library macro attach the already checked source type to that same direct call:

```haxe
genes.ts.TypeArguments.call(
	GenericCellModule.makeCell(CellPhase.Pending),
	CellPhase.Pending
);
```

The witness is syntax checked at compile time and never evaluated. genes-ts
emits `makeCell<"pending" | "ready">("pending")`; classic Genes emits only
`makeCell("pending")`. Unmarked externs, wrong witness arity, unresolved types,
runtime aliases, and non-call input fail with exact upstream diagnostics. The
NextJsHx semantic Hook macro uses this generic boundary internally so
application code remains the ordinary `React.useState(CatalogFilter.All)`.

## `GENES-CAP-CALL-IDENTITY-001`: exact fluent call identity

The original witness registry used a source position to reconnect the
pre-erasure Haxe type with the typed generic call. That is insufficient when a
library macro composes the reviewed call through a normal fluent API:

```haxe
return macro genes.ts.TypeArguments.call($call, $witness).seal();
```

Haxe may assign `makeCell(...)` and `seal()` one macro invocation span and may
relocate the inner call to the macro definition. Before PR #35, the unrelated
outer method could claim the inner registration and produce a false
`GENES-TS-EXPLICIT-TYPE-ARGS-001` unmarked-call diagnostic.

The pinned compiler attaches a deterministic, compiler-internal identity to
the reviewed value and stores its extern module, owner, field, and
static/instance kind. The TypeScript emitter scopes the witness only while it
prints that exact target; both emitters discard the identity carrier and its
key. The reduced positive output is therefore ordinary source:

```ts
const phase = makeCell<"pending" | "ready">("pending").seal();
```

Classic output remains `makeCell("pending").seal()`. Neither profile contains
a carrier import, helper, registry key, assertion, allocation, or duplicate
evaluation. Direct-call, annotation, witness-arity, broad-type, runtime-alias,
and conflicting-witness negatives remain fail-closed.

NextJsHx uses the generalized mechanism inside its closed nuqs parser macro.
Application Haxe stays concise while generated TypeScript retains exact literal
unions on both `useQueryState` and `parseAsStringLiteral`, followed by nuqs's
ordinary `.withDefault(...)` composition. The compiler implementation and its
fixtures contain no Next.js, React, or nuqs names.

## `GENES-CAP-ENUM-HIGHER-ORDER-001`: recursive closed-domain projection

The Todo URL-state model exposed a second, distinct erasure boundary. A direct
field such as `status:TodoStatusFilter` already emitted its exact literal
union, but a sibling callback such as
`selectStatus:TodoStatusFilter->Void` widened to `(arg0: string) => void`.
Haxe had proved the nominal domain, yet strict TypeScript rejected that broad
callback when it flowed back into the exact generic state API.

The framework-neutral upstream repro uses `ReviewState`, not React or Next.js,
and requires the same closed leaf in values, callback parameters and results,
arrays, nullable callbacks, typedef aliases, anonymous structures, and named
generic containers. The fixed output is ordinary TypeScript:

```ts
export type ReviewModel = {
  state: "approved" | "pending";
  select: (arg0: "approved" | "pending") => void;
  selectMany: (
    arg0: ("approved" | "pending")[]
  ) => ("approved" | "pending")[];
  envelope: Envelope<"approved" | "pending">;
};
```

The host-tuple control also retains the same domain on both positions and emits
direct indexed access:

```ts
let state: [
  "draft" | "published",
  (value: "draft" | "published") => void
] = DomainHost.make(["draft", "published"], "draft");

state[1]("published");
```

A negative Haxe fixture passes a different enum abstract with the same backing
string and requires Haxe's nominal-domain error before output exists. The
compiler caches source types only where the typed declaration explicitly
contained an enum-abstract leaf, freezes the literal spellings before DCE, and
uses that captured source type only while emitting the corresponding node.
Generic declarations remain generic, existing conservatively widened loop
temporaries remain unchanged, and neither output profile gains an assertion,
runtime helper, duplicate evaluation, or framework-specific behavior.

Downstream, `TodoDiscoveryModel` now emits exact status, priority, and view
fields *and* exact `selectStatus`, `selectPriority`, and `selectView` callback
parameters. Its nuqs values still use direct tuple `[0]`/`[1]` operations, and
the wrong-domain controls remain Haxe errors rather than TypeScript repairs.
The focused fixture passes strict TypeScript 5.5, 6.0, and 7.0 plus classic
runtime parity; the exact reviewed PR #37 head also passed the full hosted
genes-ts matrix and downstream Todo E2E lane.

## `GENES-GAP-DIR-001`: directive prologues (resolved)

The reduced [Haxe input](../tests/compiler-gaps/src/compiler_gaps/DirectiveBoundary.hx)
uses the generic literal metadata and calls another module so import ordering
is observable:

```haxe
@:keep
@:genes.moduleDirective("generic-mode")
class DirectiveBoundary {
  public static function label():String return Dependency.label();
}
```

The desired TypeScript shape is:

```ts
"generic-mode";
import { Dependency } from "./Dependency.js";
export class DirectiveBoundary { /* retained implementation */ }
```

Classic ESM needs the same semantic order:

```js
"generic-mode";
import { Dependency } from "./Dependency.js";
export const DirectiveBoundary = class DirectiveBoundary { /* ... */ };
```

The pinned genes-ts compiler now emits these exact directive-first shapes in
both profiles. Its generalized implementation accepts literal metadata only,
orders and deduplicates directives deterministically, terminates every
directive statement to avoid automatic-semicolon-insertion hazards, and keeps
the compiler independent of framework directive strings. The upstream full
TypeScript/classic regression gate and exact-head GitHub checks are green.
Bead `nxhx-f34.2.2` records the completed generalized upstream work and its
verification history.

Short generated adapters remain canonical where Next.js requires an exact
convention filename or export shape. Haxe-owned modules can use the generic
compiler capability directly without teaching genes-ts about `use client`,
`use server`, or `use cache`.

## `GENES-CAP-TEMPLATE-001`: typed string templates

Ordinary Haxe interpolation lowers to string concatenation. In TypeScript that
widens a route such as `/todos/${id}` to `string`, so Next's generated
`Route<T>` oracle rejects the result even though its runtime bytes are correct.
The pinned generalized API preserves an explicitly authored template:

```haxe
return genes.TemplateLiteral.value('/todos/${StringTools.urlEncode(id)}');
```

TypeScript output retains the useful shape:

```ts
return `/todos/${encodeURIComponent(id)}`;
```

Classic JavaScript emits equivalent parenthesized concatenation. Literal
chunks and `String` interpolations remain typed, compound interpolations stay
one authored slot, and arbitrary runtime strings fail closed. The compiler API
contains no route or Next.js policy; NextJsHx's internal href macro supplies
the route-specific parsing, exact params, codecs, and encoding.

## `GENES-GAP-DCE-001`: external callers and DCE

The reduced [application entry](../tests/compiler-gaps/src/compiler_gaps/ExternalEntry.hx)
uses the existing narrow policy:

```haxe
@:keep
class ExternalEntry {
  public static function label():String return "external-entry";
}
```

Its TypeScript output retains a precise external value:

```ts
export class ExternalEntry {
  static label(): string { return "external-entry"; }
}
```

Classic output and its adjacent declaration remain aligned:

```js
export const ExternalEntry = class ExternalEntry {
  static label() { return "external-entry"; }
};
```

```ts
export declare class ExternalEntry {
  static label(): string;
}
```

An unmarked negative-control class is absent from TS, JS, and declarations,
proving ordinary application DCE remains compact. For an application-local TS
import, `@:keep` is explicit and sufficient. For a published API graph,
genes-ts already provides `@:genes.library` plus `-D genes.library`; classic
output additionally requires `-D dts` so runtime and declarations cannot drift.

The stable Next fixture includes the component's owning package so Haxe types
the otherwise-invisible module, marks only its TS-imported component with
`@:keep`, and no longer executes a fake Haxe call. G04 should finish the
downstream discovery/API and component-handle policy, but it should not add a
second compiler mechanism. Broad `@:keep` use risks retaining private
application code, while using the library profile for a local component would
overstate package ownership.

## `GENES-GAP-EXP-001`: default export selection

The reduced [module function](../tests/compiler-gaps/src/compiler_gaps/ExportBoundary.hx)
combines supported `@:expose` with an inert default-export research marker:

```haxe
@:expose
@:genes.defaultExport
function exportedLabel():String return "exported-label";
```

Current TS and classic modules correctly emit a named value and root re-export:

```ts
export const exportedLabel = ExportBoundary_Fields_.exportedLabel;
export { exportedLabel } from "./compiler_gaps/ExportBoundary.js";
```

The hypothetical direct shape would select that value as the module default:

```ts
export { exportedLabel as default };
```

```js
export { exportedLabel as default };
```

### Decision: keep convention exports adapter-owned

G03 rejects a genes-ts default-export feature for the current product scope.
NextJsHx does not require it, and no independent non-framework consumer has
been demonstrated that would justify the compiler-wide semantics.

The compiler and adapter solve different problems:

- genes-ts already emits precise named module values and root re-exports;
- generalized module-function lowering can expose a Haxe body as a genuine
  analyzer-visible module function without choosing a public export contract;
- a Next adapter owns the exact convention filename, directive prologue,
  default or reviewed named export, route-aware signature, source collision,
  DCE root, and transactional manifest entry as one atomic decision.

Adding `@:genes.defaultExport` would solve only one line of the adapter while
creating compiler-wide questions about duplicate defaults, re-export identity,
DCE, cycles, declaration output, and parity between TypeScript and classic
JavaScript. It would not remove the adapter because convention paths,
directives, ownership, and Next-generated types would still be required.

Positive control: the reduced fixture continues to prove the supported named
shape in both compiler profiles:

```ts
export const exportedLabel = ExportBoundary_Fields_.exportedLabel;
```

Negative control: the inert research marker must not silently change the module
contract or emit:

```ts
export { exportedLabel as default };
```

The marker remains a gap fixture rather than a supported API. A future proposal
may reopen the compiler feature only with at least one independent generic
consumer and complete duplicate-default, DCE, cycle, declaration, source-map,
and dual-profile evidence. Until then, generated NextJsHx adapters are the
canonical and smaller ownership boundary.

## `GENES-CAP-JSX-001`: JSX type namespace import

React 19 does not require a compiler change. The pinned generic define

```hxml
-D genes.ts.jsx_import_source=react
```

already emits a type-only module import before TSX that uses `JSX.Element`:

```ts
import type { JSX } from "react";
```

The stable fixture compiles that output with strict TypeScript and
`skipLibCheck: false`, then completes a real production build. The risk is
configuration drift, so the support-matrix and security-tooling checks retain
the exact define; no new Bead is needed.
