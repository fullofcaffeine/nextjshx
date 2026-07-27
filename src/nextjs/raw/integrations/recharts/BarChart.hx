package nextjs.raw.integrations.recharts;

import nextjs.raw.integrations.recharts.ChartTypes.BarChartLayout;
import nextjs.raw.integrations.recharts.ChartTypes.ChartMargin;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarDatum;
import nextjs.raw.react.ReactNode;

/** Closed reviewed subset of Recharts `BarChart` props. */
typedef BarChartProps = {
	final data:Array<StackedBarDatum>;
	@:ts.optional
	final ?accessibilityLayer:Bool;
	@:ts.optional
	final ?children:ReactNode;
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?desc:String;
	@:ts.optional
	final ?layout:BarChartLayout;
	@:ts.optional
	final ?margin:ChartMargin;
	@:ts.optional
	final ?responsive:Bool;
	@:ts.optional
	final ?tabIndex:Int;
}

/** Direct named component import from Recharts' public entrypoint. */
@:jsRequire("recharts", "BarChart")
@:genes.jsxComponentProps("nextjs.raw.integrations.recharts.BarChart.BarChartProps")
extern class BarChart {}
