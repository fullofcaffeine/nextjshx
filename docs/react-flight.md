# React Flight values

React Flight is the protocol and value model React uses to carry a rendered
Server Component tree—and selected values embedded in that tree—from the
server-side React renderer to the client-side React runtime. Next.js uses
Flight for React Server Components. NextJsHx does not replace, wrap, or
reimplement that transport.

Flight is not ordinary JSON. Alongside strings, numbers, booleans, arrays, and
plain records, the pinned React 19 contract can preserve selected native values
such as `Date`, `Map`, `Set`, typed arrays, global symbols, Promises, and Server
Function references. That does **not** make arbitrary JavaScript values safe:
ordinary functions, class instances, local symbols, cyclic objects, and
unproven Promises cannot cross a Server-to-Client boundary.

## Why NextJsHx models Flight explicitly

In vanilla Next.js, the boundary is introduced by a `"use client"` module.
React and Next then diagnose unsupported values from the native module graph.
NextJsHx keeps those runtime checks and adds an earlier Haxe check: the props of
a Haxe-authored Client Component must form a closed, supported Flight value
before any adapter is published.

For example:

```haxe
import nextjs.client.flight.v19.FlightDate;
import nextjs.client.flight.v19.FlightMap;

typedef ActivityPanelProps = {
	final capturedAt:FlightDate;
	final counts:FlightMap<String, Int>;
	final labels:Array<String>;
}
```

These names erase to native `Date`, `Map<string, number>`, and `string[]`.
There is no NextJsHx serializer and no wrapper object at runtime. The explicit
`flight.v19` vocabulary makes the reviewed React compatibility lane visible in
Haxe source and prevents a raw, same-shaped value from accidentally claiming
transport support.

The Genes-owned `FlightMap<K, V>` keeps the normal JavaScript Map surface:
construction, size, lookup, mutation, callbacks, and key/value/entry
iteration. Its `get` result is more precise than Haxe 4.3.7's stock Map extern:
it returns `Undefinable<V>` because a missing JavaScript key produces
`undefined`, not a nullable stored value.

If a nested field is invalid, the diagnostic points to the complete authored
path, such as `props.sessions.values[].callback`, and no new generated output
is published.

## Which project owns which rule

The reusable part is not Next.js-specific:

- `genes.react.flight.v19` defines the versioned native React values and the
  recursive, framework-neutral validator.
- Its validator accepts closed records and supported containers, rejects broad
  or cyclic shapes, preserves the deepest available Haxe source position, and
  returns structured issue kinds that any React host can map to its own
  diagnostics.
- This belongs in Genes so Gutenberg/WordPressHx and other Haxe-to-JS/TS React
  projects can use the same semantics without importing Next.js concepts.

NextJsHx consumes that Genes surface and adds only facts Genes cannot establish
generically:

- which module is a Next Server or Client Component boundary;
- whether a Promise was created once by a reviewed server-only owner;
- whether a callable value came from a generated Next Server Function;
- whether a cached resource has the required NextJsHx provenance;
- how `nextjs.raw.react.ReactNode` participates in server-rendered composition;
  and
- the `NXHX-SERIALIZABLE-PROP-0001` diagnostic and Next build/browser evidence.

The public `nextjs.client.flight.v19` names for native scalar and collection
values remain compatibility aliases over Genes. Next-specific
`FlightPromise<T>` and `FlightServerFunction<F>` remain local, unforgeable
capabilities because their safety depends on NextJsHx construction and graph
proofs.

## Base value contract

The conservative base contract recursively accepts:

- `String`, `Bool`, `Int`, and `Float`;
- `Null<T>` and `Undefinable<T>` when `T` is accepted;
- `Array<T>` when `T` is accepted;
- closed anonymous records whose fields are all accepted;
- enum abstracts represented by an accepted string, number, or boolean;
- exact React elements/nodes supported by the host; and
- the explicitly versioned native capabilities listed in
  [Client Components](client-components.md#react-19-flight-prop-contract).

It rejects:

- `Dynamic`, `Any`, `genes.ts.Unknown`, and unresolved type parameters;
- ordinary functions and raw Promises;
- raw or local symbols;
- arbitrary class instances and runtime Haxe enums;
- recursive or cyclic value graphs; and
- abstracts whose runtime representation is not part of the reviewed contract.

An external `Unknown` value must first be decoded into a closed application
model. Flight compatibility says only that React can transport a value; it does
not validate untrusted input, authorize an operation, hide secrets, or prove
that the value is appropriate for a particular user.

## Provenance-bearing values

Some runtime types need more than structural compatibility:

- Create a `FlightGlobalSymbol` through `FlightGlobalSymbol.forKey(...)`; a raw
  `Symbol` does not prove global-registry provenance. The resulting value can
  project one way to `js.lib.Symbol` for native APIs, while `key()` retrieves
  the registry key; no reverse conversion exists.
- Create `FlightPromise<T>` only through
  `FlightResource.promise(...)` on a static final field of an
  `@:next.serverOnly` owner. A render-local Promise has the same JavaScript
  shape but not stable server ownership.
- Obtain `FlightServerFunction<F>` from a generated Server Function boundary.
  An ordinary callback with the same signature is still an ordinary function
  and remains rejected.

These constructors erase to the original native values. Their purpose is to
carry compile-time evidence, not to create a parallel runtime.

## Evidence and compatibility

Flight support is tied to the pinned React and Next.js lane rather than assumed
from structural TypeScript compatibility. Release evidence includes positive
and negative Haxe fixtures, exact generated TypeScript identities, official
React lint, a strict production Next build, and desktop/mobile browser journeys
covering hydration, Suspense resolution, rejected resources, and Server
Function invocation.

See:

- [Client Components](client-components.md#react-19-flight-prop-contract) for
  the exact capability table and application examples;
- [Server Functions](server-functions.md) for callable boundary provenance;
- [Compatibility](compatibility.md) for the pinned React/Next lane; and
- [Genes extraction review](genes-extraction-review.md) for the architectural
  ownership decision.
