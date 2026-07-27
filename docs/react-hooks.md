# Haxe-native React Hooks and bidirectional interop

NextJsHx provides two React Hook surfaces:

- `nextjs.raw.react.*` mirrors supported React contracts for exact interop; and
- `nextjs.client.*` names application intent, improves inference, and rejects
  React function-state ambiguities before TypeScript is generated.

Both call the ordinary React runtime. There is no NextJsHx Hook scheduler,
state container, memo cache, or wrapper object. ADR 0006 records the design and
rejected alternatives.

## Semantic state: the normal Haxe API

Use `nextjs.client.React` in Haxe-authored Client Components and custom Hooks:

```haxe
import nextjs.client.React;

@:next.hook
function useCounter(initial:Int):CounterModel {
	final count = React.useState(initial);
	final doubled = React.useMemo(
		(current) -> current * 2,
		React.deps(count.value)
	);

	return {
		value: count.value,
		doubled: doubled,
		set: next -> count.set(next),
		increment: () -> count.update(previous -> previous + 1)
	};
}
```

`State<S>` has three deliberately distinct operations:

| Haxe | Intent | React operation |
| --- | --- | --- |
| `state.value` | read this render's value | tuple index `0` |
| `state.set(next)` | replace the value | dispatch `next` |
| `state.update(previous -> next)` | derive from prior state | dispatch updater |

The emitted common path is direct and allocation-free:

```ts
const count = useState(initial);
const current = count[0];
const doubled = useMemo(() => current * 2, [current]);

count[1](next);
count[1](previous => previous + 1);
```

The semantic abstract does not generate `new State`, a `State_Impl_` object,
runtime getters, or bound methods.

Haxe enum abstracts retain their closed emitted union. For example,
`React.useState(CatalogFilter.All)` emits the ordinary handwritten TypeScript
form `useState<"all" | "systems" | "tools">("all")`; without that type
argument React would widen the literal to `string` and discard the domain
contract. The semantic macro preserves the Haxe-checked enum type through a
compile-time-only genes-ts witness; neither the witness nor a wrapper appears
in runtime output. Primitive `Int`, `Float`, `Bool`, and `String` state keeps
the shorter inferred call.

## Reducer-driven optimistic state

Use `React.useOptimistic` when a Server Action should update the interface
immediately and then reconcile with server-owned props:

```haxe
private typedef OptimisticRow = {
	final completed:Bool;
	final visible:Bool;
}

private enum abstract RowAction(String) {
	final Toggle = "toggle";
	final Remove = "remove";
}

final initial:OptimisticRow = {
	completed: props.completed,
	visible: true
};
final row = React.useOptimistic(initial, (current, action) -> switch action {
	case Toggle: {completed: !current.completed, visible: current.visible};
	case Remove: {completed: current.completed, visible: false};
});

row.value;
React.startTransition(() -> row.apply(RowAction.Toggle));
```

`Optimistic<State, Action>` deliberately exposes only the projected value and
one closed reducer action. It erases to the tuple React already returns:

```ts
const row = useOptimistic(initial, (current, action) => {
  // authored reducer
});

row[0];
startTransition(() => row[1]("toggle"));
```

There is no `Optimistic_Impl_`, object allocation, alternate scheduler, or
rollback helper. React owns the Action lifetime and restores the passthrough
state when that Action fails; refreshed Server Component props reconcile a
success. NextJsHx does not infer which changes are reversible. The application
must author a pure deterministic reducer and pass an action type that contains
enough information to reproduce the optimistic projection.

React requires optimistic dispatch to occur inside an Action. A form `action`
already supplies that context. For an imperative event or integration callback,
wrap `apply` with semantic `React.startTransition`; it inlines to the ordinary
named React import and call. Calling `apply` during render or from an arbitrary
callback without an Action/Transition is not supported.

A wrong action and a reducer returning the wrong state both fail in Haxe. For
example, `row.apply("toggle")` is rejected when the reducer action is `Int`;
without that closed action type, a string dispatcher could make misspellings
runtime-only states.

The faithful raw surface also exposes React's one-argument replacement/updater
overload and two-argument reducer overload as `UseOptimisticResult`. Prefer the
semantic reducer form for Haxe-owned application state because replacement and
transition intent stay explicit.

## Lazy and function-valued state

React overloads a JavaScript function value with control flow. This raw call is
declaration-valid but can execute `initialHandler` instead of storing it:

```haxe
nextjs.raw.react.React.useState(initialHandler);
```

The semantic API makes the intent explicit:

```haxe
typedef Handler = String->Void;

final handler = React.useStateLazy(() -> initialHandler);

handler.set(nextHandler);
handler.update(previous -> decorate(previous));
```

`React.useState(initialHandler)` fails at the Haxe argument with
`NXHX-REACT-STATE-0001`. The same conservative failure applies to a union with
a callable arm and to an unresolved generic value. This costs an explicit
`useStateLazy` in uncertain code and prevents React from silently applying the
wrong runtime interpretation.

For `handler.set(makeNextHandler())`, NextJsHx must both store the function and
preserve ordinary eager argument evaluation. The generated call is equivalent
to:

```ts
StateRuntime.replaceCallable(handler[1], makeNextHandler());
```

JavaScript evaluates `makeNextHandler()` once before entering the typed helper;
the helper dispatches `_previous => nextHandler`. A scalar `set(3)` remains a
direct dispatch and pays no helper or closure cost.

Lazy initializers should be pure. React development Strict Mode may invoke an
initializer more than once to expose impurities.

## Explicit memo dependencies

Semantic `useMemo` requires a direct `React.deps(...)` expression:

```haxe
final lines = React.useMemo(
	(products, currentQuantities) ->
		buildLines(products, currentQuantities),
	React.deps(products, quantities.value)
);
```

The calculation may name one parameter for every dependency. NextJsHx turns
parameters backed by computed expressions into render-local scalar snapshots;
a parameter whose name already matches a plain local dependency reuses that
binding. Haxe infers each parameter from its corresponding dependency and
checks an explicit annotation exactly. Snapshot parameters must be ordinary,
required parameters on an anonymous function or arrow calculation: named
recursive functions, optional/defaulted parameters, rest parameters, parameter
metadata, and local function type parameters fail closed because relocating
them would change their meaning.

The builder is compile-time syntax. It evaluates authored expressions once
from left to right, preserves duplicates and exact array length, and derives a
closed union element type for Haxe checking. It emits no `deps` function,
wrapper, or IIFE:

```ts
let currentQuantities: CartQuantity[] = quantities[0];
let lines: CartLine[] = useMemo(function () {
  return CartHook.buildLines(products, currentQuantities);
}, [products, currentQuantities]);
```

Use the familiar zero-argument calculation when every dependency already emits
as a lint-visible local or member chain:

```haxe
React.useMemo(
	() -> props.label.toUpperCase(),
	React.deps(props.label)
);
```

Use dependency parameters for tuple projections, array indexing, calls,
operators, and other computed expressions:

```haxe
React.useMemo(
	(current, selected) -> summarize(current, selected),
	React.deps(state.value, items[index])
);
```

These dependency lists are supported:

```haxe
React.deps();
React.deps(product);
React.deps(products, quantities.value);
React.deps(first, second, label, enabled);
```

`React.deps(...)` is invalid when stored in a variable or called by itself.
Passing a runtime dependency list to semantic `useMemo` also fails with
`NXHX-REACT-DEPS-0001`. Exact raw interop can instead declare a closed
`nextjs.raw.react.DependencyList<D>` and call raw `React.useMemo`.

`NXHX-REACT-DEPS-0002` rejects a computed dependency paired with a
zero-argument calculation, a dependency-parameter arity/type mismatch, or a
parameter shape that cannot become one scalar snapshot without changing
semantics. The diagnostic points at the Haxe call and shows the
named-snapshot form; TypeScript does not repair the relationship later.

NextJsHx does not infer missing dependencies. Doing so soundly would require
reproducing React lint's closure, alias, member-access, and generated-JavaScript
analysis. Authors must supply every reactive capture. `useMemo` remains only a
performance optimization; its result type is plain `T`, and application
correctness must not depend on cache persistence.

## Faithful raw state and tuple projection

The raw layer exposes React's replacement-or-updater union and exact positional
result:

```haxe
import nextjs.raw.react.React;

final state = React.useState(0);
final count = state.first;
final dispatch = state.second;

dispatch(3);
dispatch(previous -> previous + 1);
```

This emits `state[0]` and `state[1]`. The declaration remains the TypeScript
tuple:

```ts
type UseStateResult<S> = [S, Dispatch<S | ((previous: S) => S)>];
```

The compiler projection behind it is:

```haxe
@:ts.type("[$0, $1]")
abstract Tuple2<A, B>(Tuple2Storage<A, B>) {}
```

`@:ts.type` tells genes-ts how the type appears in generated TypeScript; it
does not add runtime code. `$0` and `$1` mean the emitted TypeScript forms of
Haxe parameters `A` and `B`. Consequently `Tuple2<String, Int>` projects to
`[string, number]`. Its internal accessors use computed native names `[0]` and
`[1]`, so Haxe retains distinct slot types while JavaScript receives ordinary
array access. The full inline explanation lives beside
`nextjs.raw.types.Tuple2`.

Raw `React.useState()` returns exact `UndefinedValue`, emitted as `undefined`.
The call itself becomes `useState<undefined>()`, preserving Haxe's checked
selection instead of asking TypeScript to infer the result again from no
arguments. It is intentionally different from `Null<T>`, which emits
`T | null`. The raw API does not pretend that Haxe 4.3.7 supports TypeScript's
defaulted, contextually selected `useState<S = undefined>()` surface; its
zero-argument overload is deliberately exact.

## Author and export a Haxe Hook

`@:next.hook` establishes reviewed Hook identity for Haxe placement checks.
The name must retain React's `use...` convention, but the marker—not the name
alone—is the Haxe identity proof:

```haxe
typedef Selection<T> = {
	final items:Array<T>;
	final index:Int;
	final select:Int->Void;
}

class CatalogHooks {
	@:next.hook
	@:next.exportHook
	public static function useSelection<T>(items:Array<T>):Selection<T> {
		final index = React.useState(0);
		return {
			items: items,
			index: index.value,
			select: next -> index.set(next)
		};
	}
}
```

`@:next.exportHook` is a separate publication request. It accepts no path or
name string. The compiler derives a collision-resistant private module from
the full typed Hook identity, retains the Haxe implementation under DCE, and
records a manifest-owned adapter:

```ts
"use client";

import { CatalogHooks } from "../../../../src-gen/example/CatalogHooks";

export const useSelection: typeof CatalogHooks.useSelection =
  CatalogHooks.useSelection;
```

This is a typed const alias, not a wrapper function. It preserves generic
inference and React Hook identity without another call frame. The adapter must
contain exactly one implementation import, one same-name named export, no
config, and a first-position `"use client"` directive.

Ordinary TypeScript consumes the result without a NextJsHx runtime API:

```tsx
"use client";

import { useSelection } from "./_nextjshx/hook/<identity>/useSelection";

export function SelectionButton() {
  const selection = useSelection(["tide", "signal"]);
  return (
    <button onClick={() => selection.select(1)}>
      {selection.items.length} choices
    </button>
  );
}
```

The executable version is
`tests/client-components/next-app/app/haxe-hook-consumer.tsx`; it consumes both
a generic and non-generic Haxe Hook plus a Haxe-authored Client Component, and
passes strict TypeScript and the real Next production build.

## Consume TypeScript, JavaScript, and existing Next modules from Haxe

The reverse direction uses precise externs. The native module keeps ownership
of its JavaScript implementation and directives:

```ts
// counter-state/index.ts
"use client";

export function useCounter(initialCount: number) {
  // ordinary native React implementation
}
```

```haxe
typedef CounterState = {
	final count:Int;
	final increment:Void->Void;
}

extern class CounterHook {
	@:next.hook
	@:jsRequire("counter-state", "useCounter")
	static function use(initialCount:Int):CounterState;
}
```

The extern is closed and exact: no `Dynamic`, `Any`, broad `unknown`, cast, or
reflection is needed. The typed marker lets Hook identity survive a Haxe import
alias. Ordinary native Next components and modules follow the same pattern:
model their public props or exports precisely, preserve their actual ESM
identity, and let their existing client/server boundary remain authoritative.

Executable interop examples include:

- `tests/client-components/hook-package/index.ts` and
  `client_components.client.CounterHook` for a native TypeScript Hook consumed
  by Haxe;
- Patchbay 06's native signal Hook consumed by a Haxe Client Component;
- the shared shadcn TSX components consumed through closed Haxe prop facades;
- the TypeScript Haxe-Hook consumer described above; and
- the landing showcase's Haxe-authored tide Hook consumed directly by its Haxe
  Client Component; and
- the commerce showcase's Haxe-authored `useShopCart`, published through a
  generated native-style Hook module.

Interop code that is genuinely native TypeScript belongs in a focused native
module or interop example. Application logic should not move to `.ts` merely
to work around a missing Haxe surface; recurring gaps should become reusable
typed Haxe APIs.

## Diagnostics and evidence boundaries

| Diagnostic | Meaning | Recovery |
| --- | --- | --- |
| `NXHX-REACT-STATE-0001` | an eager semantic state value may be callable | use `useStateLazy(() -> value)` |
| `NXHX-REACT-DEPS-0001` | semantic dependencies are non-inline, standalone, broad, or unresolved | pass direct `React.deps(...)`, or deliberately use the raw API |
| `NXHX-REACT-DEPS-0002` | a computed dependency lacks its named calculation parameter, or its parameter arity/type/shape is unsafe to relocate | use ordinary required parameters on an anonymous function or arrow calculation, one per dependency in authored order |
| `NXHX-REACT-EXPORT-0002` | an export marker is malformed or not attached to one public static reviewed Haxe Hook | correct the Hook marker, name, owner, and implementation |
| `NXHX-REACT-HOOK-0001/0002` | a reviewed Hook is outside a React function or in invalid local control flow | move it to the unconditional top level of a Client Component or custom Hook |
| `NXHX-REACT-NAME-0006` | an ordinary use-prefixed helper is called from analyzer-visible React code | rename the helper without `use`, or make it a genuine reviewed Hook |

Haxe is the primary typechecker for Haxe Hook bodies. Strict TypeScript and
Next remain independent parity and graph checks, not a substitute for Haxe
soundness. The official React lint lane validates native TypeScript Hooks,
native TSX consumers, generated adapters, and the analyzer-visible module
functions generated from reviewed Haxe Hooks and Client Components. Its
positive and negative controls prove that rules-of-hooks remains active.

Application authors only write `@:next.hook` or `@:next.clientComponent`.
NextJsHx derives the React-significant module-function name and adds the
framework-neutral genes-ts marker during typed compilation. The generated
shape is ordinary handwritten-style TypeScript:

```ts
function useSemantic(id: string, index: number): UseSortableResult {
  return useSortable({ id, index });
}

export class SortableHooks {
  static useSemantic(id: string, index: number): UseSortableResult;
  static useSemantic(): never {
    throw this;
  }
}

SortableHooks.useSemantic = useSemantic;
```

The compiler-owned seed is never called. It preserves the class method's
non-enumerable descriptor and own-key position; the immediate assignment makes
the Haxe field and module function the same value before registration or static
initialization. The body exists once and there is no delegating wrapper, cast,
assertion, helper call, or additional React identity. Components use a derived
uppercase `<TypeName>Component` module binding for the same reason.

A genuine module function necessarily differs from a class method in a few
function-object introspection details: it is constructable, owns `prototype`,
reports the derived module name, and has module-function `toString()` syntax.
Calls, exceptions, extraction, reassignment, recursion through the Haxe field,
property descriptor/order, DCE, registration, initialization, and canonical
ESM identity are preserved and are the supported compatibility contract.

The generated-body lane release-gates both `rules-of-hooks` and
`exhaustive-deps`. Allocation-free `State<S>`, `Optimistic<S, A>`, and typed
query-state reads still emit tuple indexing internally, but semantic memo
dependency parameters produce lint-visible scalar locals before the Hook call.
The calculation and inline dependency array reference the same local, so
official React lint sees the relationship a careful handwritten component
would expose. Native and generated missing-dependency controls remain active;
NextJsHx does not suppress the rule or claim to infer omitted captures.

Run the complete contract with:

```sh
npm run test:client-components
npm run test:showcases
```
