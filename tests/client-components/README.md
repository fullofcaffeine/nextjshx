# Client Component boundary fixture

This fixture owns the executable contract for Haxe-authored hydrated Client
Components, version-gated Server-to-Client props, and typed React Hook
diagnostics.

`next-app/haxe/client_components/client/InteractiveCounter.hx` is the positive
client implementation. `next-app/haxe/client_components/app/HomePage.hx` is a
server page that reaches it only through the caller-sensitive
`InteractiveCounter.client()` extension. The generated adapter is intentionally
absent from source control and is published under the deterministic private
`next-app/app/_nextjshx/client/608bef9587b3/InteractiveCounter.tsx` target during
the test. The same page also renders an ordinary reusable Server Component
without a framework base class and an explicit `@:next.shared` component from
both the server and client graphs; neither receives an unnecessary client
adapter.

The reference retains the exact Haxe props record for HXX validation while its
generated server annotation derives props from the adapter with
`Parameters<typeof import(...).default>[0]`. The positive page proves valid
props and children compile; `ClientRefWrongProp.hx` proves a wrong prop fails at
the authored HXX span before any TSX or adapter plan is written. Neither path
adds a generated import of the raw client implementation.

`client/SecondaryBoundary.hx` adds an annotated secondary Haxe type. Its
canonical module-qualified identity must select
`_nextjshx/client/c63756482b38/NestedToggle.tsx`, preventing two same-named
secondary types in different modules from sharing an inferred target.

The positive props cover primitives, a string enum abstract, a nested immutable
record, arrays, nullability, undefined-capable values, and `ReactNode` child
composition. A second boundary exercises the versioned React 19 Flight
capabilities for Date, recursively checked Map and Set values, every supported
Haxe 4.3.7 typed array, ArrayBuffer, a global `Symbol.for` value, a module-stable
server Promise consumed through `React.use` under Suspense, and a
provenance-bearing Server Function prop. A rejected server Promise reaches a
native TypeScript Error Boundary through precise Haxe interop; the browser
requires its fallback, one sanitized React production report, and no failed
response. Bounded server timers keep both module-owned Promises pending long
enough for the production browser to require the authored Suspense fallbacks
before the resolved value and Error Boundary fallback replace them. Fresh
desktop and mobile server processes prove that sequence independently. The
real production browser also clicks the Haxe-authored control and observes its
state change, proving that a successful snapshot is not being mistaken for
hydrated behavior. The component calls the reviewed `next/navigation` pathname
Hook at the top level through the Haxe binding. A Haxe-authored custom Hook
composes the precisely marked native state Hook, while allocation-free
semantic Hooks exercise state replacement, prior-state updates, safe callable
state, exact undefined/null behavior, and explicit closed memo dependencies.
Generic and non-generic Haxe Hooks publish through deterministic `"use client"`
const aliases; `app/haxe-hook-consumer.tsx` consumes them as ordinary TypeScript
alongside the generated Haxe Client Component and proves generic inference and
closed TSX props. The same bidirectional seam exercises `nuqs` URL state:
Haxe-authored nullable/defaulted String, Int, Float, and Bool state plus a
closed String enum-abstract domain export as an ordinary TypeScript Hook. Its
generated parser and Hook calls retain the exact literal union without an
assertion or compiler carrier. A native TypeScript `useQueryState` Hook is
consumed from Haxe. The server page wraps the App Router adapter in a typed
`Suspense` boundary, and the browser proves queued URL commits, clearing, and
Back/Forward restoration. A conditional
use-prefixed ordinary helper proves names alone do not select Hooks. The
secondary component exercises React `use` inside both a loop and condition
with the semantic `CachedPromise` capability.

The `negative/` modules independently reject:

- an ordinary function prop;
- a class instance prop;
- an undecoded `genes.ts.Unknown` prop;
- a recursive/cyclic type graph;
- a local symbol and ordinary Promise;
- a version-unselected raw Map and broad ArrayBuffer view;
- unsupported values nested inside Flight Map, Set, and Promise capabilities;
- a render-local attempt to create a supposedly module-stable Flight Promise;
- an ordinary callback attempting to forge Server Function provenance;
- an async Client Component render;
- a reserved Next convention path;
- `.client()` on an unannotated class;
- a string supplied to an integer prop through a generated `.client()` HXX
  reference; and
- a server page importing the raw client implementation.

Additional controls reject conditional and aliased conditional Hook
calls, loop bodies, nested callbacks, event handlers, `try` and `catch`, calls
after an early return, calls from ordinary functions, invalid React `use`
placement, an ordinary uncached Promise, `Math.random`, static mutation,
callable eager state, stored or standalone dependencies, a wrong replacement
type, and an unreviewed Hook export. Package-specific controls reject malformed,
empty, or render-variable query keys, wrong query replacements and updater
results, non-scalar semantic parsers, empty or stored literal-value arrays,
open String literal domains, mixed nominal domains, semantic query Hooks
outside a component or custom Hook, and an invalid App Router adapter prop at
the HXX span.
The runner also uses the pinned official React Hook plugin against the native
Hook seam, native TSX consumer, and generated adapters, with independent
invalid Hook, dependency, and purity controls proving all three rules are active.

Each failure must match one exact source-positioned diagnostic and must not
leave rejected adapter-plan or TSX bytes. See
[the Client Component reference](../../docs/client-components.md) for the
authoring contract, rationale, generated shape, and current allowlist; the
[React Hook reference](../../docs/react-hooks.md) covers state, memo, export,
and bidirectional interop; and the [nuqs reference](../../docs/nuqs.md) covers
closed URL domains, history behavior, and raw escape hatches.

Run:

```sh
npm run test:client-components
```

The runner cleans all generated output and temporary dependency links in both
success and failure paths.
