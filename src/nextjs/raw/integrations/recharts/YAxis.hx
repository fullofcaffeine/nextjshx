package nextjs.raw.integrations.recharts;

import nextjs.raw.integrations.recharts.ChartTypes.AxisType;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarCategoryKey;

/** Closed category-axis subset used by a stacked bar chart. */
typedef YAxisProps = {
	final dataKey:StackedBarCategoryKey;
	final type:AxisType;
	@:ts.optional
	final ?axisLine:Bool;
	@:ts.optional
	final ?tickLine:Bool;
	@:ts.optional
	final ?width:Int;
}

/** Direct named component import from Recharts' public entrypoint. */
@:jsRequire("recharts", "YAxis")
@:genes.jsxComponentProps("nextjs.raw.integrations.recharts.YAxis.YAxisProps")
extern class YAxis {}
