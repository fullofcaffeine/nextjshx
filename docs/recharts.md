# Typed planning charts with Recharts

NextJsHx integrates Recharts `3.8.1` for one practical result: application code
can render a responsive two-series stacked bar from a closed Haxe model, and a
misspelled data key or malformed row fails before TSX exists. Recharts remains
the chart runtime. The Haxe layer narrows its very broad chart API to the shape
that has actually been reviewed and tested.

This integration was added while building the flagship Field Ledger Todo app.
The app needed to answer three questions at a glance: how much work remains,
whether urgent P0 work remains, and how open versus completed work is spread
across P0, P1, and P2. A decorative dashboard would not help. One compact
priority runway, backed by the same values in an accessible table, does.

## Small mental model

The supported flow is:

```text
closed application records
  -> pure Haxe projection with category/primary/secondary fields
  -> direct Recharts BarChart/Bar composition
  -> responsive SVG plus the same values in an HTML table
```

`category` names the row, such as `P0`. `primary` and `secondary` are the two
numeric series. The semantic `StackedBars` constructor fixes those three keys,
so application code supplies meaningful labels, colors, and values without
repeating string keys.

## Reviewed package contract

The runtime is exactly `recharts` `3.8.1`, MIT licensed, from
<https://github.com/recharts/recharts>. The root lock records integrity
`sha512-mwzmO1s9sFL0TduUpwndxCUNoXsBw3u3E/0+A+cLcrSfQitSG62L32N69GhqUrrT5qKcAE3pCGVINC6pqkBBQg==`.
The reviewed public declaration is `types/index.d.ts`, with SHA-256
`e99285f74c22ad823c0b9fac55316b84144e15eb91830034badd9eb0fafe71bf`.

The supported named exports are deliberately limited to:

- `BarChart`;
- `Bar`;
- `CartesianGrid`;
- `XAxis`; and
- `YAxis`.

Recharts requires `react-is` to match the application React version. The
example therefore pins both `react` and `react-is` to `19.2.7`; the latter has
lock integrity
`sha512-kZFnouyVv7eP/Phmrlo9FK+zcAdriZJvzxXHF1Sl1P377WSGe2G/JxVolhTrB/jeV47lKImhNUsijjHAAbcl/A==`.

There is one temporary transitive compatibility constraint. Recharts accepts
any Redux Toolkit `2.x`, but the newest resolution currently selects Redux
Toolkit `2.12.0` and Immer `11.1.15`. Immer's declaration adds an optional
global `Iterator.from`, which conflicts with TypeScript `6.0.2` when strict
library checking is enabled. The repository pins the compatible, still
supported Redux Toolkit `2.10.1`, which uses Immer `10.2.0`, through npm
`overrides`. Recharts declares that version valid, and strict checking stays
enabled. Remove this override only after an executable clean-install probe
shows that the current transitive declarations agree with TypeScript 6; do not
replace it with `skipLibCheck`.

The exact package identity, declaration, exports, owned source, and evidence
are recorded in
[`config/package-integrations.json`](../config/package-integrations.json).

## Haxe authoring

Build ordered rows and one closed model:

```haxe
final rows = [
	StackedBars.row("P0", p0Open, p0Completed),
	StackedBars.row("P1", p1Open, p1Completed),
	StackedBars.row("P2", p2Open, p2Completed)
];
final chart = StackedBars.create(
	rows,
	"Open",
	"var(--planning-open)",
	"Filed",
	"var(--planning-filed)"
);
```

Then compose the raw package components directly in HXX:

```haxe
<BarChart
	data={chart.rows}
	responsive={true}
	accessibilityLayer={true}
	layout={BarChartLayout.Vertical}
	className="planning-chart"
	desc="Open and completed work grouped by priority."
>
	<CartesianGrid horizontal={false} vertical={true} stroke="var(--planning-grid)" />
	<XAxis type={AxisType.Number} allowDecimals={false} />
	<YAxis type={AxisType.Category} dataKey={StackedBarCategoryKey.Category} />
	<Bar dataKey={chart.primary.key} fill={chart.primary.color} stackId="work" />
	<Bar dataKey={chart.secondary.key} fill={chart.secondary.color} stackId="work" />
</BarChart>
```

The generated TSX imports those five names from `recharts` and emits the same
component tree. There is no wrapper component, runtime key conversion,
assertion, or generated dependency helper.

## What fails before TypeScript

The category key and numeric-series keys are different nominal Haxe types.
These errors are therefore local to the HXX attribute that caused them:

```haxe
<Bar dataKey={StackedBarCategoryKey.Category} />;
// error: Bar dataKey expects StackedBarSeriesKey

<YAxis
	type={AxisType.Category}
	dataKey={StackedBarSeriesKey.Primary}
/>;
// error: YAxis dataKey expects StackedBarCategoryKey
```

A row missing `secondary`, or a `barSize="wide"`, also fails in Haxe and emits
no rejected TSX. Strict TypeScript remains an independent parity check against
the installed declaration rather than the first typechecker.

## Tooltip and accessibility boundary

The reviewed surface intentionally omits Recharts `Tooltip`. Its public
payload still contains `any`, and accepting that payload would leak a broad
type into repository-owned application code. A visual tooltip also cannot be
the only way to recover a chart value.

Field Ledger instead uses Recharts' keyboard/screen-reader accessibility layer,
a descriptive SVG `desc`, a visible typed legend, and an ordinary HTML table
whose rows come from the exact same `StackedBarDatum` array. This is a narrower
API and a stronger baseline: pointer, keyboard, and screen-reader users can all
recover the exact P0/P1/P2 values. A future tooltip binding needs a new closed
payload projection plus malformed-boundary tests; it must not expose the
upstream broad payload directly.

## Evidence and upgrade path

Run the focused boundary with:

```sh
npm run test:recharts
npm run test:integrations
npm run test:example:todoapp
```

The first command proves deterministic direct TSX, four exact Haxe negatives,
strict TypeScript, and an active official React Hook lint control. The shared
integration gate checks version, integrity, declaration digest, exports, and
owned evidence. The Todo lane adds production Next compilation, desktop/mobile
layout, accessible table agreement, URL-filter updates, browser diagnostics,
and measured client-bundle impact.

In the pinned production build, the command/drag/URL client chunk was 210,583
raw bytes and 67,114 gzip bytes before Recharts. With the planning surface it is
537,191 raw bytes and 162,660 gzip bytes: an observed increase of 326,608 raw
and 95,546 gzip bytes in this application build. The gate caps the union of
identified command and planning chunks at 560 KiB raw and 170 KiB gzip. This is
a whole-chunk comparison, not a claim that every byte in the increase belongs
to one Recharts export. It makes the cost visible and leaves room only for
small deterministic toolchain variation; a larger change requires a new
measurement and design review.

For an upgrade, review the public declaration and release notes, test whether
the Redux Toolkit override is still required, update the exact inventory only
after that review, and rerun all three lanes. Changing a digest or enabling
`skipLibCheck` merely to obtain a green build is not an upgrade review.
