package nextjs.raw.integrations.recharts;

import nextjs.raw.integrations.recharts.ChartTypes.AxisType;

/** Closed numeric-axis subset used by a stacked bar chart. */
typedef XAxisProps = {
	final type:AxisType;
	@:ts.optional
	final ?allowDecimals:Bool;
	@:ts.optional
	final ?axisLine:Bool;
	@:ts.optional
	final ?hide:Bool;
	@:ts.optional
	final ?tickCount:Int;
	@:ts.optional
	final ?tickLine:Bool;
}

/** Direct named component import from Recharts' public entrypoint. */
@:jsRequire("recharts", "XAxis")
@:genes.jsxComponentProps("nextjs.raw.integrations.recharts.XAxis.XAxisProps")
extern class XAxis {}
