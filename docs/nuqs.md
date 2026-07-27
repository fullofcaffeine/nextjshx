# Typed URL state with nuqs

NextJsHx integrates `nuqs` 2.9.1 as the URL-state layer for Client Components.
The package remains the runtime: generated code imports its public `nuqs` and
`nuqs/adapters/next/app` entrypoints directly. The Haxe layer adds a faithful
raw boundary plus an intent-oriented API that separates replacement, update,
and clearing while preserving nuqs promises and browser-history behavior.

The integration was added while building URL-backed filters for the flagship
Todo application. The upstream setter combines a replacement value, `null`,
and an updater in one callable union. That shape is precise in TypeScript but
needlessly exposes overload intent at every Haxe call site. It also made a
compiler output gap visible: an exact projected `null` was emitted through a
redundant helper assertion. The framework-neutral compiler fix is documented
and reviewed in [genes-ts PR #27](https://github.com/fullofcaffeine/genes-ts/pull/27).

## App Router setup

Wrap the client subtree that owns query state with nuqs's App Router adapter.
The adapter is an exact component import, so HXX validates its closed props
before TSX generation:

```haxe
import nextjs.raw.integrations.nuqs.NuqsAdapter;
import nextjs.raw.integrations.nuqs.QueryOptions.QueryHistory;
import nextjs.raw.react.Suspense;

final fallback = <p>Loading URL filters...</p>;
return <Suspense fallback={fallback}>
	<NuqsAdapter defaultOptions={{history: QueryHistory.Push}}>
		<QueryPanel />
	</NuqsAdapter>
</Suspense>;
```

`Push` is useful when Back and Forward should replay filter changes. Use
`Replace` when updates should keep one history entry. The default remains
nuqs's own default; NextJsHx does not replace its router or queue. The
`Suspense` boundary is required for a statically rendered App Router page
because nuqs observes search parameters in the client subtree. A production
Next build independently enforces that boundary.

## Semantic query state

Use the inference-friendly parser helpers from a Client Component or a
`@:next.hook` function:

```haxe
import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

enum abstract TodoView(String) to String {
	final All = "all";
	final Active = "active";
	final Done = "done";
}

final view = Nuqs.useQueryState("view",
	Parsers.stringLiteral([TodoView.All, TodoView.Active, TodoView.Done], TodoView.All));
final search = Nuqs.useQueryState("search", Parsers.string());
final page = Nuqs.useQueryState("page", Parsers.integer(1));
final progress = Nuqs.useQueryState("progress", Parsers.float(0.5));
final archived = Nuqs.useQueryState("archived", Parsers.boolean(false));

view.value;      // TodoView
search.value;    // Null<String>
page.value;      // Int
progress.value;  // Float
archived.value;  // Bool

view.set(TodoView.Active);
page.update(previous -> previous + 1);
search.clear();
```

A parser with no argument produces nullable state. Supplying one default makes
the current value non-nullable. `set`, `update`, and `clear` all return nuqs's
real `Promise<URLSearchParams>`; an event handler may discard that result, while
an orchestration Hook can retain it.

The state view allocates no object. The generated implementation uses the
original tuple and reads or calls its positions directly:

```ts
let view = useQueryState<"active" | "all" | "done">(
  "view",
  parseAsStringLiteral<"active" | "all" | "done">(
    ["all", "active", "done"],
  ).withDefault("all"),
);
let search: NullableQueryState<string> =
  useQueryState("search", parseAsString);

view[1]("active");
search[1](function (current: string | null) {
  return current === null ? "haxe" : current + "!";
});
search[1](null);
```

There is no semantic state constructor, assertion, or runtime facade.

## Closed string domains

`Parsers.stringLiteral` deliberately requires one String-backed Haxe enum
abstract, a non-empty inline value array, and a default from that same nominal
domain. Haxe proves all four conditions at the authored expression before any
TypeScript exists. The generated call retains the corresponding literal union,
so native TypeScript consumers see the same closed model rather than `string`.
An untrusted URL value outside the list is still handled by nuqs at runtime and
resolves to the declared default.

This is accepted:

```haxe
final status = Nuqs.useQueryState("status", Parsers.stringLiteral([
	TodoStatusFilter.All,
	TodoStatusFilter.Open,
	TodoStatusFilter.Done
], TodoStatusFilter.All));
```

These controls fail with `NXHX-NUQS-LITERAL-0003` at the relevant Haxe span:

```haxe
Parsers.stringLiteral([], TodoStatusFilter.All); // empty domain

final values = [TodoStatusFilter.All, TodoStatusFilter.Done];
Parsers.stringLiteral(values, TodoStatusFilter.All); // domain is not inline

Parsers.stringLiteral(["all", "done"], "all"); // open String

Parsers.stringLiteral(
	[TodoStatusFilter.All, AnotherStatus.Done],
	TodoStatusFilter.All
); // two nominal domains
```

Nested typedef aliases are resolved recursively, but unresolved or excessively
deep alias chains fail closed. Use `Parsers.string(...)` when the application
genuinely wants arbitrary string state, or the raw nuqs surface for a custom
runtime parser. No TypeScript assertion, generated helper, or post-generation
typecheck is used to make a rejected Haxe expression acceptable.

The fluent `.withDefault(...)` composition exposed a framework-neutral macro
call-identity gap: Haxe may give the inner generic parser call and the outer
method one source span. [genes-ts PR #35](https://github.com/fullofcaffeine/genes-ts/pull/35)
binds the compile-time type witness to the exact extern owner and field, then
erases its compiler-only carrier in both output profiles. That is why the
generated code above can retain both literal unions while still looking like
handwritten nuqs TypeScript.

The Todo integration then exposed a separate higher-order form of the same
source-type erasure: model value fields retained their exact enum-abstract
unions, while callback fields such as
`selectStatus:TodoStatusFilter->Void` widened to `string -> void`. That made an
otherwise Haxe-proved callback incompatible with nuqs's exact state domain in
strict TypeScript. [genes-ts PR #37](https://github.com/fullofcaffeine/genes-ts/pull/37)
captures the pre-erasure source type only for declarations that contain a
closed enum-abstract leaf and projects it recursively through callbacks,
arrays, nullability, aliases, anonymous structures, and generic applications.
The generated Todo model now exposes exact status, priority, and view callbacks
and continues to call the underlying tuple positions directly. There is no
TypeScript assertion, runtime helper, React/nuqs special case, or widened
repository-owned boundary.

## Stable keys and parser scope

The semantic API requires a compile-time key matching
`[A-Za-z][A-Za-z0-9._~-]*`. This catches empty keys, URL delimiters, and values
that could change between renders at the authored Haxe span. A deliberately
runtime key belongs to `nextjs.raw.integrations.nuqs.Nuqs.useQueryState`.

The initial semantic parser set covers the package's string, integer, float,
and boolean builders, including scalar-domain abstracts. Arbitrary object,
array, date, JSON, multi-key, server-loader, and custom parser shapes remain on
the raw surface until each has a closed reusable Haxe design and executable
evidence. Unsupported semantic parser values fail with
`NXHX-NUQS-PARSER-0002`; the facade does not silently widen them.

Call-specific package options remain available without abandoning the semantic
state:

```haxe
import nextjs.raw.integrations.nuqs.QueryOptions;
import nextjs.raw.integrations.nuqs.QueryOptions.QueryHistory;

final options:QueryOptions = {
	history: QueryHistory.Replace,
	shallow: true,
	scroll: false
};

page.setWithOptions(3, options);
page.updateWithOptions(previous -> previous + 1, options);
page.clearWithOptions(options);
```

`debounce` and `throttle` are available from the raw `Nuqs` binding and produce
the package's exact `LimitUrlUpdates` value.

## Bidirectional Hook interop

A native TypeScript Hook is consumed from Haxe through a precise extern marked
with `@:next.hook`:

```haxe
typedef NativeQueryLabel = {
	final value:String;
	final replace:String->Promise<URLSearchParams>;
	final clear:Void->Promise<URLSearchParams>;
}

extern class NativeQueryHooks {
	@:next.hook
	@:jsRequire("@nextjshx/client-fixture-hook", "useNativeQueryLabel")
	static function useNativeQueryLabel(key:String):NativeQueryLabel;
}
```

A Haxe-authored Hook can be exported in the other direction:

```haxe
enum abstract TodoView(String) to String {
	final All = "all";
	final Active = "active";
}

typedef TodoQueryModel = {
	final view:TodoView;
	final showActive:Void->Void;
}

@:keep
class QueryHooks {
	@:next.hook
	@:next.exportHook
	public static function useTodoQuery():TodoQueryModel {
		final view = Nuqs.useQueryState("view",
			Parsers.stringLiteral([TodoView.All, TodoView.Active], TodoView.All));
		return {
			view: view.value,
			showActive: () -> {
				view.set(TodoView.Active);
			}
		};
	}
}
```

NextJsHx generates a deterministic client adapter with a type-preserving const
alias, not a wrapper call:

```ts
"use client";

export const useTodoQuery: typeof QueryHooks.useTodoQuery =
  QueryHooks.useTodoQuery;
```

Ordinary TypeScript then imports `useTodoQuery` like any native Hook. Both
directions retain Hook identity for placement diagnostics and official React
lint.

## Evidence

`npm run test:client-components` proves:

- nullable/defaulted String, Int, Float, and Bool inference;
- exact String enum-abstract domains and literal-union TypeScript projection;
- canonical direct imports and tuple operations;
- exact malformed, empty, and dynamic key diagnostics;
- exact empty, non-inline, open, and mixed literal-domain diagnostics;
- wrong replacement/updater rejection in Haxe;
- non-scalar semantic parser rejection;
- Hook placement and adapter-prop HXX failures before output is committed;
- Haxe-authored Hook export and native TypeScript Hook consumption;
- strict Next production compilation and official React Hook lint; and
- hydrated URL changes, clearing, and Back/Forward restoration in Chromium.

`npm run test:integrations` independently verifies the installed package
version, license, repository, lock integrity, public export map, declarations,
declaration digests, and reviewed source inventory.
