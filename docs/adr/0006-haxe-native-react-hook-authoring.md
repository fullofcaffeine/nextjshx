# ADR 0006: Haxe-native React Hook authoring

- Status: Accepted
- Date: 2026-07-19
- Amended: 2026-07-27 — generic React authoring moved to `genes.react`
- Decision owners: project owner and NextJsHx maintainers
- Related Beads: `nxhx-f34.5.8.9`, `nxhx-ble.3.4`
- Related ADRs: 0001, 0003, 0004
- Related PRD sections: 6.2, 12.1–12.4, 16.2, 17.2, 18

## Context

NextJsHx already identified reviewed Hooks by typed Haxe field identity and
checked locally provable placement mistakes. It did not provide a Haxe-native
state or memo surface. Interactive examples therefore had to consume a native
TypeScript Hook even when the state transition logic belonged naturally in
Haxe.

While moving the commerce cart into Haxe, three React declaration/runtime
details made a mechanical extern insufficient:

1. `useState` returns a heterogeneous tuple. An array whose element is a union
   cannot prove that index zero is the state and index one is the dispatcher.
2. React interprets a function passed as an initial value as a lazy initializer
   and a function passed to the dispatcher as an updater. A declaration that
   accepts `S | (() -> S)` cannot distinguish the intent to store a function.
3. memo dependencies are heterogeneous and must remain a direct, constant-size
   array expression. A broad array, assertion, or runtime builder would weaken
   Haxe checking and hide the list from React tooling.

The authoring layer should preserve React names and runtime behavior while
using Haxe to make these intents explicit. It must not allocate a state wrapper,
introduce a parallel Hook runtime, or infer dependencies unsoundly. Because
these contracts apply equally to Gutenberg and other React hosts, their
framework-neutral implementation belongs in `genes.react`; NextJsHx owns only
Next-specific composition and graph policy.

### Compiler experiments

Focused Haxe 4.3.7 and pinned genes-ts probes established the implementation
boundary:

- a framework-neutral `@:ts.type("[$0, $1]")` projection plus computed
  `@:native("[0]")` and `@:native("[1]")` storage access preserves tuple
  declarations and emits direct indexed access;
- an abstract semantic `State<S>` erases to that tuple with no constructor,
  object, getter call, or bound method;
- closed heterogeneous dependency arrays can be typed with nested
  `EitherType` arms and still emit one ordinary inline array;
- a raw no-argument overload can produce exact `undefined`, but Haxe cannot
  faithfully select TypeScript's defaulted generic `useState<S = undefined>()`
  from result context; attempting both overloads can widen unresolved output;
  therefore only exact no-argument `undefined` is admitted; and
- TypeScript widens a primitive literal passed to `useState`, so semantic
  enum-abstract state must carry Haxe's checked emitted union as an explicit
  generic argument while ordinary primitive state remains inference-only. The
  pinned genes-ts call-site witness preserves that closed pre-erasure type on
  the direct opted-in extern call and disappears from runtime output; and
- ordinary genes-ts output keeps Haxe static methods as TypeScript class
  methods, which JavaScript Hook analyzers do not treat as module-level custom
  Hooks. The accepted follow-up uses the generalized
  `@:genes.moduleFunction` compiler capability: NextJsHx adds it internally to
  reviewed Haxe Hooks and Client Component renders, genes-ts emits the body once
  as a genuine module function, and the original static field is installed as
  that exact value before registration or initialization. This preserves the
  Haxe API while making the generated body visible to official React lint.

The first implementation kept the semantic macros in NextJsHx. Downstream
consumption later proved that state, optimistic state, dependency snapshots,
Hook typing, and analyzer-visible React functions have no Next.js dependency.
Those capabilities now live in the generic `genes.react` layer. NextJsHx still
derives its Next-owned Hook and Client Component markers, checks App Router
client/server graph policy, and provides cached-resource `use` plus Transition
composition.

## Decision

### Keep faithful raw and intent-oriented semantic layers

The two public layers have deliberately different jobs:

| Concern | `nextjs.raw.react` | `genes.react` semantic layer |
| --- | --- | --- |
| state action | `EitherType<S, S -> S>` | hidden behind `set` and `update` |
| state result | exact mutable `Tuple2` projection | allocation-free `State<S>` abstract |
| eager initial state | faithful `S | (() -> S)` ambiguity | `useState(value)` rejects possibly callable values |
| lazy/function state | same raw channel | `useStateLazy(() -> value)` |
| replacement | raw dispatcher union | `state.set(value)` |
| transition | raw dispatcher union | `state.update(previous -> next)` |
| memo dependencies | `DependencyList<D>` | direct `deps(...)`, with inferred calculation parameters for computed snapshots |
| dependency inference | none | none |
| optimistic state | exact React tuple and dispatcher | allocation-free `Optimistic<State, Action>` with `value` and `apply` |
| imperative Action context | raw `startTransition` | NextJsHx semantic `nextjs.client.React.startTransition` |

Representative semantic Haxe is:

```haxe
import genes.react.React.deps;
import genes.react.React.useMemo;
import genes.react.React.useState;

final count = useState(0);

count.value;
count.set(3);
count.update(previous -> previous + 1);

final doubled = useMemo(
	(current) -> current * 2,
	deps(count.value)
);
```

The ordinary scalar path emits the equivalent React operations:

```ts
const count = useState(0);
count[0];
count[1](3);
count[1](previous => previous + 1);

const current = count[0];
const doubled = useMemo(() => current * 2, [current]);
```

The tuple is the only runtime state object. `State<S>` adds names and checking,
not storage.

### Make function-valued state explicit

Direct semantic initialization fails when the static type is callable,
contains a callable union arm, is an unconstrained type parameter, or cannot be
classified safely:

```haxe
// GTS-REACT-STATE-001
final handler = useState(initialHandler);
```

The explicit safe form is:

```haxe
final handler = useStateLazy(() -> initialHandler);
handler.set(nextHandler);
handler.update(previous -> decorate(previous));
```

`useStateLazy` passes the authored initializer directly. It does not wrap it a
second time. A callable replacement uses React's required constant updater.
The replacement expression is evaluated as the argument to one private typed
helper before the updater closure is created, preserving eager, exactly-once
evaluation:

```ts
replaceCallableState(handler[1], makeNextHandler());
```

The concrete helper is private Genes output; the scalar path does not pay for
that helper or closure.

### Keep dependency authorship explicit and closed

`deps(...)` is compile-time packaging, not a runtime function. It is valid only
as the direct second argument of semantic `useMemo`. The Genes macro
types every expression, builds a closed element union, preserves authored
order and duplicates, and emits only the literal array.

```haxe
final lines = useMemo(
	(products, currentQuantities) ->
		buildLines(products, currentQuantities),
	deps(products, quantities.value)
);
```

One calculation parameter corresponds to one dependency in authored order.
Plain locals with matching names require no alias; computed expressions become
render-local scalar snapshots referenced by both the zero-argument React
callback and inline array. Haxe checks parameter arity and exact annotated
types, while runtime evaluation remains left-to-right and exactly once.
Only ordinary required parameters on anonymous functions or arrow calculations
are relocatable. Named recursion, optional/default/rest semantics, parameter
metadata, and local function type parameters fail closed.

No dependency completeness is inferred. Alias analysis and React's dependency
semantics are too subtle for a weaker duplicate implementation. Review remains
required, and official React exhaustive-dependencies analysis runs over the
actual generated module-function body. `useMemo` continues to return plain
`T`; it is an optimization, not stable storage or a correctness capability.

Storing `deps(...)`, supplying a runtime array to semantic `useMemo`, or
using unresolved/broad dependency values fails with
`GTS-REACT-DEPS-001`. Deliberately dynamic raw interop uses
`nextjs.raw.react.React.useMemo` with a precisely typed `DependencyList<D>`.
Computed dependencies without named calculation parameters and unsafe
parameter arity, type, or shape fail with `GTS-REACT-DEPS-002`.

### Keep optimistic projection typed and React-owned

The semantic optimistic surface follows the same tuple-erasure rule as state:

```haxe
final row = useOptimistic(initial, reduceRow);

row.value;
React.startTransition(() -> row.apply(RowAction.Toggle));
```

`Optimistic<State, Action>` erases to React's
`[State, Dispatch<Action>]`. The Haxe reducer must return the exact passthrough
state and `apply` accepts only its closed action type. There is no wrapper,
parallel rollback store, inferred inverse, or framework-specific compiler
behavior. React owns Action lifetime and rollback; updated Server Component
props reconcile successful Server Actions.

Form actions already provide Action context. An imperative callback uses the
semantic `React.startTransition`, which inlines to React's named import. The
surface documents rather than conceals this runtime requirement: dispatching
optimism during render or outside an Action/Transition remains invalid React.

### Preserve `null` and `undefined` separately

`Null<T>` continues to mean `T | null`. `UndefinedValue` is the exact raw
JavaScript `undefined` type. Raw `React.useState()` returns
`UseStateResult<UndefinedValue>`.

NextJsHx does not expose a contextual generic no-argument state overload until
Haxe can prove its result type without widening. It does not model undefined as
null and does not add a runtime type witness solely to force inference.

### Export Haxe Hooks through native-style client modules

A Haxe-authored Hook remains a public static, use-prefixed function marked with
`@:next.hook`. `@:next.exportHook` separately requests publication for native
TypeScript consumers:

```haxe
class CatalogHooks {
	@:next.hook
	@:next.exportHook
	public static function useSelection<T>(items:Array<T>):Selection<T> {
		// Haxe implementation
	}
}
```

The adapter path is deterministic and private:

```text
_nextjshx/hook/<12-character identity hash>/useSelection.ts
```

The generated public module is ordinary directive-first TypeScript:

```ts
"use client";

import { CatalogHooks } from "<generated-implementation>";

export const useSelection: typeof CatalogHooks.useSelection =
  CatalogHooks.useSelection;
```

The `typeof` annotation preserves method generics and the const alias adds no
per-call wrapper. The build roots the implementation for Haxe DCE, validates
the use-prefixed name and reviewed Hook identity, and publishes the adapter
through the same collision-safe manifest transaction as other generated
modules. A native TypeScript Hook remains consumable in the other direction
through an exact `@:jsRequire` extern carrying `@:next.hook`.

Internal genes-ts modules may retain compiler implementation artifacts. They
remain private behind the canonical adapter. Public generated TypeScript/TSX
must use native directives, imports, exports, and syntax and must not expose a
Haxe runtime type, assertion, broad type, or avoidable wrapper.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| `Array<EitherType<S, Dispatch<...>>>` | loses positional slot types |
| allocated `{ value, set }` wrapper | allocates every render and does not match React's tuple |
| always wrap initial values lazily | changes evaluation timing, exceptions, side effects, and later-render work |
| pass every replacement directly | callable values are invoked as updaters |
| capture callable replacement inside the updater | delays evaluation until React processes the update |
| use `Null<T>` for no-argument state | conflates JavaScript null and undefined |
| broad `unknown[]`, `Any`, or `Dynamic` dependencies | violates the closed boundary contract |
| `as const` or another TypeScript assertion | unchecked and unnecessary |
| runtime `deps(...)` helper | hides the inline list and adds a runtime call |
| inferred dependencies | cannot soundly reproduce React lint, alias, and closure semantics |
| wrapper-function Hook adapter | adds a call and complicates generic forwarding |
| React-specific genes-ts behavior | violates the compiler ownership boundary |
| allocated optimistic wrapper or local rollback store | duplicates React state, risks divergent reconciliation, and adds per-render objects |
| open string optimistic actions | turns spelling and payload mistakes into runtime states |

## Consequences

The client-component gate now requires:

- raw tuple declarations, indexed reads, scalar and updater dispatch, exact
  undefined, and raw memo output;
- allocation-free semantic state, lazy callable state, callable replacement,
  nullability, optimistic reducer state, and zero/one/heterogeneous/duplicate-type dependency arrays;
- exact negative Haxe diagnostics for callable initialization, stored or
  standalone dependencies, wrong replacement/optimistic action/reducer types,
  and unreviewed exports;
- deterministic generic and non-generic Hook adapter plans;
- native TypeScript consuming both generated Haxe Hook exports with generic
  inference, and Haxe consuming a native TypeScript Hook through a precise
  extern;
- strict TypeScript, Next production build, manifest ownership, official React
  lint controls on applicable modules, and hydrated React behavior; and
- the commerce showcase running its cart through a reusable Haxe-authored Hook.

The complete authoring and interop reference is
[react-hooks.md](../react-hooks.md).
