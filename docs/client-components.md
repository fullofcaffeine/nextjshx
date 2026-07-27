# Haxe Client Components and typed boundary refs

NextJsHx models a hydrated React Client Component as one Haxe class annotated
with zero-argument `@:next.clientComponent`. The compiler infers a private,
deterministic native Next boundary; server Haxe code enables the explicit
`nextjs.client.ClientComponent` static extension and renders it through
`ComponentType.client()` rather than importing or invoking the raw
implementation. [ADR 0004](adr/0004-haxe-native-react-component-authoring.md)
records the full component model and alternatives.

## Why this layer was needed

While developing the first Haxe-authored hydrated fixture, a normal Haxe
reference exposed the wrong graph edge. Calling a client implementation from a
server page made genes-ts emit a direct import of the implementation module.
That import was type-correct Haxe and TypeScript, but it bypassed Next's native
`"use client"` entry and pulled client implementation code into the server
module graph. Adding a string directive to arbitrary application code would
also leave path placement, DCE reachability, and prop serializability
uncontrolled.

The semantic layer fixes that mismatch while retaining Next's runtime model:

- the annotation validates one concrete component and records one adapter;
- the adapter owns exactly one first-position `"use client"` directive;
- `Component.client()` emits a precisely typed, caller-relative import of that
  adapter without a raw client implementation import in the server module;
- the component is retained under Haxe DCE because the native adapter is an
  external caller that Haxe cannot otherwise see; and
- a conservative recursive prop check reports the exact unsupported field path
  during Haxe compilation.

There is no NextJsHx component runtime, proxy component, or second
serialization protocol. The generated adapter delegates directly to the
genes-ts implementation.

## Positive: render a typed Client Component boundary

The client implementation exposes exactly one public static, non-generic, synchronous
`render(props): genes.react.Element` function.

```haxe
package example.client;

import genes.react.Element;
import nextjs.raw.react.ReactNode;

enum abstract CounterTone(String) to String {
	final Tide = "tide";
	final Signal = "signal";
}

typedef CounterProps = {
	final label:String;
	final initialCount:Int;
	final tone:CounterTone;
	final details:{
		final enabled:Bool;
		final ratio:Float;
		final hints:Array<String>;
		final note:Null<String>;
	};
	final children:ReactNode;
}

@:next.clientComponent
class Counter {
	public static function render(props:CounterProps):Element {
		final state = CounterHook.use(props.initialCount);
		return <section data-tone={props.tone}>
			<p>{props.label}</p>
			<strong>{state.count}</strong>
			<button type={"button"} onClick={state.increment}>Increment</button>
			<div>{props.children}</div>
		</section>;
	}
}
```

A server page requests the generated boundary ref. The component type is
inferred from `Counter.render`. The HXX parser checks markup syntax and Haxe
checks every interpolated expression or explicitly typed props record; strict
TypeScript then checks the emitted tag, required props, children, and direct
attribute values against React's JSX declarations. Thus normal `generate`,
`typecheck`, and `build` fail before runtime on either class of error, while the
explicit `generate --no-check` escape does not run the TypeScript prop oracle.

```haxe
package example.app;

import example.client.Counter;
import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

using nextjs.client.ClientComponent;

@:next.page("")
class HomePage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final CounterBoundary = Counter.client();
		return <CounterBoundary
			label={"Live harbor reading"}
			initialCount={2}
			tone={"tide"}
			details={{enabled: true, ratio: 1.25, hints: ["typed", "hydrated"], note: null}}>
			<span>Server-rendered child composition</span>
		</CounterBoundary>;
	}
}
```

The host renderer materializes the native boundary shape:

`example.client.Counter` maps to
`_nextjshx/client/47ceb049fe37/Counter.tsx` under the App Router root.

```tsx
"use client";

import { Counter } from "../../../../src-gen/example/client/Counter";
import type { ComponentType } from "react";

const NextJsHxDefault: ComponentType<
  Parameters<typeof Counter.render>[0]
> = Counter.render;
export default NextJsHxDefault;
```

The server implementation imports only that generated default export. Its prop
marker is a TypeScript type query against the adapter, so no value or type-only
import of `example.client.Counter` leaks into the server graph.

## Typed Hook identity and custom Hook composition

NextJsHx does not decide that a function is a Hook merely because its name
starts with `use`. A reviewed native binding or Haxe-authored custom Hook
declares zero-argument `@:next.hook`; the diagnostic pass then follows the
resolved typed field identity through imports and import aliases. The reviewed
`next/navigation`, `next/compat/router`, and `next/link` Hook bindings already
carry this marker.

A native seam identifies the actual Hook once:

```haxe
typedef CounterState = {
	final count:Int;
	final increment:Void->Void;
}

extern class CounterStateHook {
	@:next.hook
	@:jsRequire("counter-state", "useCounterState")
	static function use(initialCount:Int):CounterState;
}
```

A Haxe custom Hook uses the same marker and may compose other reviewed Hooks:

```haxe
class CounterHooks {
	@:next.hook
	public static function useCounter(initialCount:Int):CounterState {
		return CounterStateHook.use(initialCount);
	}
}
```

The function must remain static or module-level, use React's `use`-prefixed
naming convention, and have no metadata arguments. An extern Hook may omit a
body; a Haxe custom Hook body is audited as its own legal Hook root. A Client
Component can import that exact field under another name and call it at the top
level:

```haxe
import example.client.CounterHooks.useCounter as useFixtureCounter;

public static function render(props:CounterProps):Element {
	final state = useFixtureCounter(props.initialCount);
	final pathname = Navigation.usePathname();
	return <p data-pathname={pathname}>{state.count}</p>;
}
```

The analyzer rejects a reviewed Hook in a conditional branch, loop body,
nested callback, event handler, `try` body, `catch` body, ordinary helper, or
after a conditional early return. It reports the resolved Hook and the Haxe
call position:

```haxe
if (props.enabled) {
	CounterStateHook.use(0); // NXHX-REACT-HOOK-0002
}
```

Without typed identity, an alias could be missed and an ordinary helper could
be mistaken for a Hook during Haxe placement analysis. NextJsHx classifies the
actual field, not its name. Generated JavaScript must also pass official React
lint, whose public convention reserves `use...` spellings. Calling an unmarked
`useFriendlyLabel` from an analyzer-visible component therefore fails early as
`NXHX-REACT-NAME-0006`: rename the ordinary helper to `friendlyLabel`, or mark
and structure a genuine Hook. This keeps Haxe diagnostics precise without
emitting a name that downstream React tooling must interpret differently.

## React `use` is not a Hook

React 19.2's `use` has its own marker and placement rules. It may run inside
conditions and loops, but only while a Client Component or custom Hook is
rendering, never in a nested callback or `try`/`catch`. Rejected Promises must
flow to an Error Boundary because React uses throwing to integrate with
Suspense.

The raw and semantic layers preserve different responsibilities:

- `nextjs.raw.react.React.use` faithfully accepts a public React `Context<T>`
  or ordinary `Promise<T>`. It cannot prove Promise identity.
- `nextjs.client.React.use` accepts a `Context<T>` or
  `nextjs.client.CachedPromise<T>` from a reviewed client-side provider, or a
  server-created `nextjs.client.flight.v19.FlightPromise<T>`. Neither
  capability converts from an ordinary `Promise`: an extern provider owns the
  former identity, while `FlightResource.promise(...)` proves module-stable
  server construction for the latter.

This makes the cached-Promise requirement visible in Haxe:

```haxe
extern class CatalogResources {
	@:jsRequire("catalog-resources", "cachedProducts")
	static function products():Array<CachedPromise<Array<Product>>>;
}

for (resource in CatalogResources.products()) {
	if (props.showProducts) {
		final products = React.use(resource); // valid React use placement
	}
}
```

Passing `Promise.resolve(...)` directly to the semantic `React.use` fails Haxe
overload resolution before output. The raw escape remains explicit for faithful
interop, and a dishonest extern can still falsely claim stable identity; React
runtime warnings and the real Next build remain necessary evidence.

Pinned Haxe 4.3.7 has a typed `try`/`catch` expression but no Haxe-authored
`finally` expression. Consequently, Hook calls in native TypeScript `finally`
blocks are outside this Haxe diagnostic's executable scope. They remain
prohibited by React and subject to native TypeScript tooling; the test suite
does not manufacture a Haxe `finally` fixture or claim Haxe source-position
coverage where no Haxe call site exists.

## Locally sound render-purity checks

The same typed pass rejects two high-confidence render defects in Client
Component and custom Hook bodies:

- direct calls to the known non-idempotent `Math.random` and `Date.now`; and
- direct assignment or increment/decrement of a static Haxe field, whose value
  survives the current render.

`NXHX-REACT-PURITY-0004` points at the call or mutation and recommends a stable
input, lazy state initialization, event handler, or Effect. Local mutation of a
value created during the render is not rejected. A non-idempotent call inside
an event-handler lambda is also outside the render-purity check, although a
Hook call there remains invalid.

This is intentionally not a whole-program effect system. Haxe cannot soundly
prove arbitrary third-party function purity, callback execution timing,
mutations hidden behind aliases, Hook dependency-array completeness, Effect
behavior, refs, or transitive native JavaScript. The official
`eslint-plugin-react-hooks` lane checks the dedicated native-interoperability
fixture, generated adapters, and actual analyzer-visible module functions
emitted from reviewed Haxe Hooks and Client Components. Typed memo snapshot
parameters give computed
tuple projections one scalar binding shared by the callback and inline
dependency array, so `exhaustive-deps` can inspect the same relationship.
Haxe's typed pass remains authoritative for source placement and closed types;
strict TypeScript, official React lint, `next build`, and hydrated runtime
behavior remain independent oracles.

| Diagnostic | Meaning | Recovery |
| --- | --- | --- |
| `NXHX-REACT-HOOK-0001` | A reviewed Hook is called outside a Client Component or custom Hook | Move the call, or mark a genuine use-prefixed custom Hook with `@:next.hook` |
| `NXHX-REACT-HOOK-0002` | A reviewed Hook is in a locally conditional/repeated/protected/nested path or follows an early return | Move it to the unconditional top level before early returns |
| `NXHX-REACT-USE-0003` | React `use` is outside render, nested, or protected by `try`/`catch` | Call it directly in a Component/Hook; use conditions freely and an Error Boundary for rejection |
| `NXHX-REACT-PURITY-0004` | A known non-idempotent call or non-local static mutation runs during render | Supply stable data or move the effect outside render |
| `NXHX-REACT-METADATA-0005` | Reviewed Hook metadata is duplicated, parameterized, or attached to an unsupported field | Keep one zero-argument marker on a static/module-level function |
| `NXHX-REACT-STATE-0001` | An eager semantic state value may be callable and React could execute it as an initializer | Use `React.useStateLazy(() -> value)` |
| `NXHX-REACT-DEPS-0001` | Semantic memo dependencies are not one direct closed `React.deps(...)` expression | Inline the explicit dependencies or deliberately use the raw memo binding |
| `NXHX-REACT-DEPS-0002` | A computed memo dependency lacks a matching calculation parameter, or its parameter arity/type/shape is unsafe to relocate | Use ordinary required parameters on an anonymous function or arrow calculation, one per dependency in authored order |
| `NXHX-REACT-EXPORT-0002` | A Hook publication request is not one public static use-prefixed reviewed Haxe Hook | Correct the Hook declaration or remove `@:next.exportHook` |

The state, memo, export-adapter, callable-value, and bidirectional interop
contracts are documented in the dedicated
[React Hook reference](react-hooks.md). The maintained
[nuqs integration](nuqs.md) applies those contracts to typed URL state and
proves nullable/defaulted scalar parsers, App Router history, and Hooks authored
on either side of the Haxe/TypeScript boundary.

## React 19 Flight prop contract

The base allowlist remains intentionally smaller than every value React may
support. It recursively accepts:

- `String`, `Bool`, `Int`, and `Float`;
- `Null<T>` and `Undefinable<T>` when `T` is allowed;
- `Array<T>` when `T` is allowed;
- plain anonymous records whose fields are all allowed;
- enum abstracts represented by an allowed string, number, or boolean; and
- `nextjs.raw.react.ReactNode` for normal server-rendered child composition.

For the pinned React 19.2.7 / Next.js 16.2.12 lane, the versioned
`nextjs.client.flight.v19` package adds only values whose Haxe identity,
generated TypeScript, and Flight runtime behavior are all exercised:

The upstream contract is React's
[`use client` serializable-types reference](https://react.dev/reference/rsc/use-client)
as consumed through Next's
[`use client` boundary](https://nextjs.org/docs/app/api-reference/directives/use-client).
Upstream documentation is necessary but not sufficient here: each row below
also needs local compile, strict-TypeScript, production-Next, and browser
evidence.

| Haxe capability | Generated TypeScript/runtime | Extra invariant |
| --- | --- | --- |
| `FlightDate` | native `Date` | must use the versioned capability name |
| `FlightMap<K, V>` | native `Map<K, V>` | keys and values are checked independently; `get` correctly returns `Undefinable<V>` |
| `FlightSet<T>` | native `Set<T>` | every element type is checked |
| `FlightArrayBuffer` | native `ArrayBuffer` | no `ArrayBufferView` widening |
| `FlightInt8Array`, `FlightInt16Array`, `FlightInt32Array`, `FlightUint8Array`, `FlightUint8ClampedArray`, `FlightUint16Array`, `FlightUint32Array`, `FlightFloat32Array`, `FlightFloat64Array` | corresponding native typed array | only exact concrete identities are accepted |
| `FlightGlobalSymbol` | native `symbol` | constructible only through `FlightGlobalSymbol.forKey`, which emits `Symbol.for(key)` |
| `FlightPromise<T>` | native `Promise<T>` | module-stable server ownership and recursively supported `T` |
| `FlightServerFunction<F>` | exact function signature `F` | constructible only from a validated generated Server Function boundary |

The package name is part of the compatibility gate. Raw `js.lib.Map`,
`js.lib.Symbol`, `js.lib.Promise`, and broad `ArrayBufferView` values remain
rejected even when their JavaScript shape looks similar. This prevents a later
React contract change from silently expanding existing applications. The
fixture separately locks the exact npm versions and every emitted native type;
the support-matrix drift lane controls upgrades.

### Module-stable Promise resources

Create a Promise once on an explicit server-only owner:

```haxe
import nextjs.client.flight.v19.FlightPromise;
import nextjs.server.FlightResource;

typedef ProductSummary = {
	final name:String;
	final count:Int;
}

@:next.serverOnly
class ProductResources {
	public static final summary:FlightPromise<ProductSummary> =
		FlightResource.promise(js.lib.Promise.resolve({
			name: "Harbor light",
			count: 3
		}));
}
```

`FlightResource.promise(...)` is a compile-time capability constructor. It
accepts only a static final field initializer on an `@:next.serverOnly` owner,
checks the resolved value recursively, and erases to the original Promise.
Calling it from `render`, a helper method, or another expression scope fails
with `NXHX-FLIGHT-PROMISE-0001`. An ordinary `Promise<T>` cannot be converted
implicitly.

A Client Component reads the prop with the normal React API:

```haxe
typedef ProductPanelProps = {
	final resource:FlightPromise<ProductSummary>;
}

@:next.clientComponent
class ProductPanel {
	public static function render(props:ProductPanelProps):Element {
		final summary = React.use(props.resource);
		return <p>{summary.name + " / " + summary.count}</p>;
	}
}
```

The server composes that component under `Suspense`. A rejection must be
handled by an Error Boundary, never `try`/`catch` around `React.use`. The
production fixture proves both outcomes: a resolved resource hydrates, while a
rejected resource renders the reviewed Error Boundary fallback, produces no
failed response, and yields React's single sanitized production report rather
than exposing the server error text. Both Promises remain pending long enough
for fresh desktop and mobile production-server runs to observe the authored
Suspense fallback first and its resolved or rejected replacement afterward.

Boundary placement is a composition property of the rendered React tree, not
a property of `FlightPromise<T>` itself. NextJsHx therefore does not pretend a
local Haxe type can prove that some distant ancestor is a Suspense or Error
Boundary. Keep both boundaries explicit at the server composition site. The
fixture locks the exact generated nesting and fails if either wrapper is
removed; the browser then proves loading replacement and rejection behavior.
Haxe independently rejects `React.use` outside render and inside `try`/`catch`,
while the production Next/React runtime remains the oracle for tree topology.

### Server Functions as props

Use `ServerFunction.boundary(Action.method)` when an action crosses through a
Client Component prop:

```haxe
typedef SavePanelProps = {
	final save:FlightServerFunction<String->js.lib.Promise<String>>;
}

final SavePanel = SavePanel.client();
final save = ServerFunction.boundary(ProductActions.save);
return <SavePanel save={save} />;
```

The returned abstract remains directly callable and erases to the exact
function signature, but it has no public constructor or conversion from an
ordinary callback. A same-shaped function therefore fails to assign. The
existing `ServerFunction.ref(...)` remains source-compatible for direct use
such as a form `action`; `boundary(...)` is the explicit provenance-bearing
form for Flight props. `callable()` removes the nominal view only after the
reference has already been validated, for host declarations that nest a
function inside another exact union.

Unsupported values still include ordinary functions, arbitrary class
instances and containers, local symbols, ordinary Promises,
`genes.ts.Unknown`, broad dynamic values, runtime Haxe enums, recursive/cyclic
type graphs, and abstracts with an unsupported runtime representation. Nested
diagnostics preserve the complete path, including
`props.sessions.values[]`, `props.resource.resolved.callback`, and
`props.root.children[]`.

This remains a fail-closed authoring contract, not a claim that TypeScript can
prove arbitrary runtime objects. React-supported categories without a precise
Haxe/genes-ts model and production fixture—including bigint values and bigint
typed arrays in the current Haxe toolchain—remain unavailable. There is no
escape hatch that silently weakens the boundary.

`haxe.ds.ReadOnlyArray<T>` is also withheld: the pinned genes-ts output widens
that Haxe view to mutable `T[]`. Plain `Array<T>` remains supported until a
generalized compiler improvement can preserve the read-only contract in emitted
TypeScript without regressions.

## Negative: importing the raw implementation

This server page is rejected even though an ordinary Haxe call would otherwise
type-check:

```haxe
@:next.page("unsafe")
class UnsafePage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return Counter.render({
			label: "Bypassed boundary",
			initialCount: 0,
			tone: "signal",
			details: {enabled: true, ratio: 1.0, hints: [], note: null},
			children: <span>unsafe</span>
		});
	}
}
```

The compiler reports `NXHX-BOUNDARY-IMPORT-0002` and directs the author to
`Counter.client()`. Without this rejection, the emitted server page
would import the client implementation directly, bypassing the adapter that
defines Next's client graph entry.

A function prop such as `onSelect:String->Void` also fails before an adapter
plan is written:

```text
[NXHX-SERIALIZABLE-PROP-0001] props.onSelect is not a supported React boundary value: ordinary functions cannot cross the Server-to-Client boundary
```

Server Functions provide their own generated `ServerFunction.ref` contract.
An ordinary callback is not treated as an action by inference; see the
[Server Function reference](server-functions.md).

## Inferred paths, compatibility, and ownership

The primary annotation has no path. The full Haxe type name deterministically
selects `_nextjshx/client/<12-character SHA-256>/<Type>.tsx` below the discovered
App Router root. The underscore-prefixed folder is private to Next routing, and
the digest prevents source-package, filesystem-case, reserved-name, and
secondary-type ambiguity. Haxe consumers never spell that target.

`ClientComponent.ref(Counter)` remains a source-compatible central form and
resolves the same inferred adapter. A one-string
`@:next.clientComponent("explicit/path")` annotation remains a validated
placement override for a mixed native application that already imports a
stable target. It is exceptional rather than the form generated or shown by
new examples.

Both forms still go through the same manifest, checksum, collision,
transaction, and rollback policy as every other generated adapter. Migrating
from an explicit path creates the inferred adapter and removes the old one only
when the old bytes are manifest-owned and unchanged; an existing native or
modified file is never overwritten or deleted implicitly.

## Evidence

Run the focused contract with the repository's pinned Node 20.19.3 toolchain:

```sh
npm run test:client-components
```

The fixture compiles the positive graph twice and compares every generated
digest, validates the schema and reviewed adapter-plan snapshot, and requires
43 exact Haxe failures. Those controls cover unsafe props and graph edges plus
conditional, aliased, looped, nested, event-handler, protected-block,
post-return, and outside-render Hook calls; special `use` placement; an
uncached Promise; and direct purity failures. It then runs the pinned official
React Hook/purity lints against the applicable native/adaptor TSX, strict
TypeScript with `skipLibCheck: false`, a Next 16.2.12 Turbopack production
build, and a Playwright-driven production browser. The browser verifies the
top-level reviewed `usePathname`, server child composition, and a hydrated Haxe
click from `2` to `3`, with no page errors, console errors, or failed
responses.

The Haxe graph audit is deliberately an early local guard. Native TypeScript,
third-party packages, conditional exports, and the complete transitive bundle
are outside its full visibility. Next remains the final graph oracle through
strict generated TypeScript, `next build`, and runtime evidence.
