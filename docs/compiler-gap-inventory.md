# genes-ts compiler gap inventory

This inventory reduces the compiler-facing seams exposed by the stable fixture
to ordinary Haxe-to-TypeScript/JavaScript contracts. The repro source contains
no Next.js, React, route, adapter, or project-specific names.

The evidence is pinned to genes-ts `1.32.0` at commit
`1e7e323fdbda4c5b93689355294bd978e9170725`, Haxe `4.3.7`, and both supported
genes output profiles. Run it with:

```sh
npm run test:compiler-gaps
```

## Prioritized result

| ID | Priority | Finding | Disposition |
| --- | --- | --- | --- |
| `GENES-GAP-DIR-001` | P1 | Module directive prologues are not expressible. | Generic compiler work remains in `nxhx-f34.2.2` (G02). |
| `GENES-GAP-DCE-001` | P1 | Authored TS callers are invisible to Haxe DCE, but genes-ts already has narrow application and library policies. | Adopt and prove the existing policies in `nxhx-f34.2.4` (G04); no new compiler primitive is justified. |
| `GENES-GAP-EXP-001` | P2 | Named module/root exports exist; arbitrary default-export selection does not. | Keep adapters canonical while `nxhx-f34.2.3` (G03) evaluates broader compiler value. |
| `GENES-CAP-JSX-001` | — | Module-scoped JSX type imports already work through `genes.ts.jsx_import_source`. | Keep the pinned define and strict TSX fixture; no compiler issue. |

## `GENES-GAP-DIR-001`: directive prologues

The reduced [Haxe input](../tests/compiler-gaps/src/compiler_gaps/DirectiveBoundary.hx)
uses an intentionally inert research marker and calls another module so import
ordering is observable:

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

Current genes-ts emits the import first and emits no directive in either
profile. G02 must decide the final generic API and prove literal-only input,
deterministic order, deduplication, placement before every import, classic/TS
parity, and focused diagnostics. It must not know framework directive strings.

The current NextJsHx workaround is a short generated adapter that owns its
directive prologue. That is semantically safe and remains canonical even if
genes-ts later supports directives directly. Risks in compiler work include
silently accepting non-literals, conflicting declarations in one Haxe module,
placing a directive after imports, and widening application DCE.

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

NextJsHx does not require this compiler feature. Exact filenames, framework
types, default functions, and named configuration exports already belong to
manifest-owned adapters. G03 should accept compiler work only if a generic
non-framework use case justifies its API and proves duplicate-default errors,
DCE, declarations, cycles, and both output profiles. Otherwise it should record
the adapter decision and close without a compiler patch.

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
