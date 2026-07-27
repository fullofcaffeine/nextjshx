# Component-boundary reports

`nextjshx boundaries` explains where Haxe component capabilities begin and,
after a compatible production build, which final browser chunks Next associated
with each generated Client Component adapter.

```sh
nextjshx build
nextjshx boundaries
nextjshx boundaries --json > boundary-report.json
```

The report joins two independent evidence sources:

- `haxe-known`: exact classified owners, source ranges, generated adapters,
  component property signatures, typed direct dependencies, and generated
  Client Component or Server Function references;
- `next-observed`: exact client-reference manifest entries and static chunk
  bytes from a completed production build made by the configured Next version;
- `unavailable`: evidence that could not be established, with the reason.

Those labels matter. Haxe cannot see native TypeScript imports or arbitrary
third-party transitive edges. Next owns that final graph. Conversely, a Next
client-reference manifest records bundler output, not Haxe source intent. The
command reports both without turning either partial view into a false
whole-program proof.

## Positive: keep the boundary at the interactive leaf

```haxe
@:next.page("catalogue")
class CataloguePage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final Toggle = CatalogueToggle.client();
		return <main>
			{LargeCatalogue.render()}
			<Toggle label="Compare" />
		</main>;
	}
}
```

`LargeCatalogue` remains a Server Component on this route. Only
`CatalogueToggle` and its client dependencies hydrate.

## Negative control: clientify the whole view

```haxe
@:next.clientComponent
class CatalogueDashboard {
	public static function render(props:CatalogueDashboardProps):Element {
		final count = React.useState(0);
		return <main>
			{LargeCatalogue.render()}
			<button onClick={() -> count.update(value -> value + 1)}>
				{props.label + ": " + count.value}
			</button>
		</main>;
	}
}
```

This is valid, but the boundary sends the otherwise static catalogue module to
the browser. The focused fixture renders the same catalogue and counter through
both designs. With the pinned toolchain, it observes 61,346 client bytes for
the leaf and 64,798 for the high boundary. Exact names and byte counts may
change when Next or the source changes; the invariant is that the negative
control is larger and its `haxe-known` dependencies include the substantial
shared view.

The remediation is concrete: move the Client Component boundary to the
smallest interactive leaf. When an interactive shell needs server-rendered
content, pass it through a serializable `ReactNode` slot instead of importing
its implementation into the client subtree.

## Optional warning budgets

Budgets are warnings, not type or security proofs:

```json
{
  "boundaries": {
    "maxDirectDependencies": 8,
    "maxObservedClientBytes": 65536
  }
}
```

`maxDirectDependencies` counts project-local, Haxe-visible direct dependencies.
`maxObservedClientBytes` sums distinct static chunks listed for that generated
adapter by compatible Next client-reference manifests. Shared runtime chunks
are included because this is an observed loading closure, not an attribution
estimate. No byte warning is produced when the build is absent, incomplete,
version-incompatible, or does not expose the adapter.

## Determinism and CI safety

Machine output uses sorted arrays and project-relative paths; `projectRoot` is
the portable `"."`. The reader requires `.next/BUILD_ID`, verifies the recorded
Next version, rejects evidence when watched Haxe, generated, App Router, or
identity inputs are newer than that build, reads regular files only, and parses
the JSON assignment in client-reference manifests without executing their
JavaScript.
`all-client-adapters-observed` means every generated Client Component adapter
in this Haxe plan had a matching entry; it does not mean the native or
third-party module graph is otherwise complete.

Run the proof with:

```sh
npm run test:clientification-boundaries
```

Keep `npm run test:environment-boundaries` as a separate gate. Known request,
server-only, client-only, shared-pure, and raw implementation violations fail
in Haxe where visible, while its native-only poison-import control must still
fail in `next build`.
