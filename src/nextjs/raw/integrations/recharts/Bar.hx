package nextjs.raw.integrations.recharts;

import nextjs.raw.integrations.recharts.ChartTypes.StackedBarSeriesKey;

/** Closed reviewed subset of Recharts `Bar` props. */
typedef BarProps = {
	final dataKey:StackedBarSeriesKey;
	@:ts.optional
	final ?barSize:Int;
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?fill:String;
	@:ts.optional
	final ?isAnimationActive:Bool;
	@:ts.optional
	final ?maxBarSize:Int;
	@:ts.optional
	final ?name:String;
	@:ts.optional
	final ?stackId:String;
}

/** Direct named component import from Recharts' public entrypoint. */
@:jsRequire("recharts", "Bar")
@:genes.jsxComponentProps("nextjs.raw.integrations.recharts.Bar.BarProps")
extern class Bar {}
