# ADR 0008: Independent output language and intent profiles

- Status: Accepted
- Date: 2026-07-27
- Decision owners: project owner and NextJsHx maintainers
- Related Beads: `nxhx-f34.6.12`, `nxhx-f34.9.1`, `nxhx-f34.9.5`,
  `nxhx-f34.9.8`
- Related PRD sections: 14, 15, 16, 18, 23

## Context

NextJsHx uses Haxe as the application authoring and verification language while
Next.js remains the router, React Server Component runtime, compiler, bundler,
development server, production builder, and deployment model. The generated
application must therefore satisfy two independent needs:

1. Next may consume TypeScript/TSX or JavaScript/JSX.
2. The emitted source may prioritize human review and debugging or apply
   measured whole-program transformations that ordinary handwritten source
   cannot perform.

These are different decisions. TypeScript does not imply readable output, and
JavaScript does not imply optimized output. Combining them into one mode would
make users change source language merely to choose an optimization policy.

The independent Oracle review recommended calling the human-oriented intent
`reviewable` rather than `native-source`. The latter already describes
application-owned TypeScript/TSX in the package-integration architecture and
could incorrectly suggest that generated files are editable or have been
transferred to native ownership.

The project owner selected TypeScript plus optimized output as the target
default. The current repository does not yet contain final-pipeline benchmark,
source-map, analyzer, and debugging evidence sufficient to claim that
optimized output has earned general-availability or default status. This ADR
separates the intended product default from the evidence required before it can
ship.

## Decision

### Keep language and intent independent

The public configuration has two axes:

```text
language: typescript | javascript
intent:   reviewable | optimized
```

`language` selects the source language consumed by Next:

- `typescript` emits `.ts` and `.tsx`, retains checked TypeScript types, and is
  the language default;
- `javascript` emits `.js` and `.jsx`; Haxe remains authoritative for Haxe/HXX,
  and generated declarations preserve native-consumer types where required.

`intent` selects the generated-source contract:

- `reviewable` emits deterministic source deliberately shaped like careful
  handwritten Next.js: ordinary named module functions, direct JSX/TSX,
  meaningful names, canonical imports, first-position directives, clean
  declarations, and the minimum semantically necessary runtime machinery;
- `optimized` may additionally apply measured whole-program transformations
  that use closed Haxe program knowledge unavailable to ordinary per-module
  JavaScript/TypeScript tooling.

Both intents remain generated, manifest-owned output. Reviewability grants
inspection and debugging quality, not edit authority. Ownership transfer stays
an explicit transactional operation.

### Make TypeScript plus optimized the target default, not an unearned claim

The target new-project default is:

```json
{
  "language": "typescript",
  "intent": "optimized"
}
```

That default becomes active only after the optimized TypeScript profile passes
its release gates. Before then:

- setup writes an explicit released profile rather than silently substituting
  one intent for another;
- preview and CI commands may build optimized output only when they identify it
  as experimental;
- `reviewable + typescript` is the semantic, debugging, and differential
  baseline against which optimized output is checked;
- an existing project remains pinned to its explicit profile and profile
  version across upgrades.

If optimized output has not passed its gates, tooling must not accept
`optimized` and quietly emit reviewable output. It either runs an explicitly
experimental profile or fails with a profile diagnostic and a safe alternative.

### Use one stable configured profile across normal development and production

`dev`, `generate`, `typecheck`, `test`, and `build` use the same configured
language, intent, and profile version. `NODE_ENV`, command name, or production
deployment must not switch reviewable output to optimized output implicitly.

This keeps generated paths, analyzer inputs, cache keys, Fast Refresh
boundaries, stack traces, source maps, and production reproduction stable.

CI and benchmarking may generate another profile into an isolated temporary
root. Such output:

- cannot update the normal ownership manifest;
- cannot become the last-good development tree;
- cannot overwrite or remove published profile artifacts;
- must state the compared profile and fingerprint in its report.

### Preserve the same public and runtime semantics in every released cell

Every released language/intent combination preserves:

- the same Haxe source-level API and HXX checks;
- Next.js and React runtime behavior;
- directive prologues, canonical imports, exports, and one ESM identity;
- evaluation order, Promise scheduling, exception timing, and observable
  function/component/Hook identity;
- React Hook placement and official analyzer visibility;
- Next convention and static-analyzer visibility;
- server/client/shared graph boundaries and poisoning imports;
- generated-output ownership, collision refusal, transactional publication,
  and deterministic recovery;
- stable public native module paths and declarations;
- source-positioned diagnostics and composed source maps;
- deterministic output for one complete fingerprint.

JavaScript output is not a weaker authoring mode. It still starts from the same
checked Haxe semantics and must emit declarations for TypeScript consumers of
public Haxe modules.

### Define reviewable output positively

Reviewable output must be useful to a TypeScript/JavaScript Next developer
without knowledge of Haxe compiler internals. It therefore prefers:

- named module functions for components, Hooks, actions, handlers, and cache
  functions;
- direct JSX/TSX and natural control flow;
- stable source-derived names and formatting;
- canonical native package specifiers;
- minimal, named runtime helpers only where semantics require them;
- no avoidable Haxe class registration, `__name__`, `__class__`, private hash
  import, assertion, wrapper, or temporary;
- clean public declarations that do not expose private Haxe representations;
- composed maps with normalized project-relative Haxe sources and
  `sourcesContent`.

This is a release-tested output contract, not a best-effort formatting option.

### Require an optimization decision registry and final-pipeline evidence

Optimized output is not defined as unreadable output. Shared transformations
that improve both performance and source quality belong in both intents.

An optimized-only transformation must record:

- its stable identifier and generic mechanism;
- the semantic and escape/identity preconditions;
- protected React/Next analyzer boundaries;
- whether it applied or why it skipped;
- source-map and declaration behavior;
- the representative benchmark and final Next artifact affected.

Initial plausible candidates include specialized closed decoders,
representation specialization, monomorphization of proven hot closed helpers,
escape-proven intermediate collection removal, closure-allocation removal
outside identity-sensitive boundaries, static dispatch, and closed server-only
graph pruning.

A transformation is promoted only when:

1. differential tests show identical observable semantics;
2. official React and Next analyzers still see every protected boundary;
3. HMR, source maps, stacks, declarations, and ownership remain correct;
4. a representative application shows a repeatable material improvement in a
   final Next output or runtime metric beyond measured noise;
5. no protected user-facing metric regresses materially;
6. the mechanism and tradeoff remain explainable from the manifest/report.

Pre-Next generated byte size, minified names, or a microbenchmark alone is not
promotion evidence. Exact numeric thresholds belong to the versioned benchmark
policy after baseline variance is measured; they are not hard-coded in this
architecture decision.

### Make unsupported behavior explicit

The CLI validates the complete profile before publication. A profile or
capability that is not released must fail with a stable diagnostic describing:

- configured language, intent, and profile version;
- unsupported capability or transformation;
- relevant Haxe source and generated target when known;
- whether no output was published and the last-good tree was retained;
- the released profile or native/raw alternative, when one is safe.

An individual optional optimization may skip when the optimized contract
permits that behavior, but the skip and reason are recorded. The tooling may
not silently change language, intent, public declarations, source-map policy,
or a framework boundary.

### Version and fingerprint the output contract

Configuration schema v2 makes profile policy application intent rather than a
collection of genes-ts defines. The effective profile includes at least:

```json
{
  "output": {
    "language": "typescript",
    "intent": "reviewable",
    "profileVersion": 1,
    "sourceMaps": "external",
    "sourcesContent": true,
    "declarations": "public",
    "jsxRuntime": "automatic"
  }
}
```

The exact public schema lands with the compiler-owned setup migration. The
effective fingerprint includes the normalized profile plus the NextJsHx,
Haxe, genes-ts, Next, React, TypeScript, Node, package-manager, lockfile,
binding, public-export, source, route, and capability identities that affect
output.

Caches are namespaced by the full relevant fingerprint. Analysis may be shared
between profiles only when a narrower fingerprint proves independence.
Profile switches publish transactionally and remove stale files only when the
current manifest owns their exact bytes.

### Keep framework and compiler ownership separate

genes-ts owns framework-neutral capabilities such as TypeScript/JavaScript
emission, module-function lowering, source maps, naming, declarations, generic
static imports, and generic optimization mechanisms.

NextJsHx owns profile policy, React/Next analyzer boundaries, directives and
convention adapters, server/client graph rules, public module stability,
profile fingerprints, Next build/debug verification, and diagnostics.

No Next.js-specific optimization or convention rule belongs in genes-ts.

## Migration

1. Add schema-v2 parsing and an explicit migration report while continuing to
   read schema v1 during a bounded compatibility window.
2. Synthesize genes-ts defines, output extensions, JSX runtime settings,
   macro installation, and toolchain identities into a manifest-owned
   `.nextjshx/toolchain/` plan.
3. Treat any future `native-source` intent spelling as a deprecated alias for
   `reviewable`; do not alter the existing package-integration strategy named
   `native-source + haxe-facade`.
4. Import current generated behavior as a migration baseline, not as a
   permanent public intent named `legacy`.
5. Qualify TypeScript reviewable first as the differential/debugging oracle.
6. Qualify JavaScript reviewable independently using actual JS/JSX checks and
   declaration consumers.
7. Keep optimized cells experimental until their per-transformation and
   complete-profile gates pass.
8. Activate TypeScript optimized as the new-project default only after those
   gates pass. Existing projects never switch implicitly.

## Consequences

- Users can choose source language without surrendering or acquiring
  optimizations accidentally.
- The project retains its intended optimized default while refusing to market
  unmeasured compiler artifacts as performance.
- Reviewable output becomes a precise debugging and interoperability contract,
  not merely unminified output.
- Four combinations increase release cost, so each cell has an explicit
  maturity status and independent evidence.
- Development and production remain reproducible because one project profile
  is stable across commands.
- Profile state becomes part of ownership, caching, public API, and incident
  evidence rather than a loose compiler flag.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| Couple TypeScript to reviewable and JavaScript to optimized | Language and optimization policy are independent user needs. |
| Call the human-oriented intent `native-source` | It conflicts with application-owned native source and implies edit authority that generated output does not have. |
| Automatically use reviewable in dev and optimized in production | It changes analyzer inputs, generated files, caches, HMR boundaries, stacks, and production reproduction implicitly. |
| Declare optimized the default before release evidence | It converts an intended product direction into an unsupported performance claim. |
| Make reviewable permanently default because evidence is currently missing | It discards the maintainer's product goal instead of defining how optimized earns default status. |
| Treat unreadable or smaller pre-bundle output as optimized | Next transforms the source again; only protected semantics and representative final-pipeline evidence justify the mode. |
| Silently fall back to another profile | The user would test and debug different source from the profile they selected. |
| Put Next/React profile policy in genes-ts | It couples a general compiler to one framework and obscures ownership of analyzer/runtime guarantees. |
