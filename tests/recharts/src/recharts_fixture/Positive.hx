package recharts_fixture;

import genes.react.Element;
import nextjs.integrations.recharts.StackedBars;
import nextjs.raw.integrations.recharts.Bar;
import nextjs.raw.integrations.recharts.BarChart;
import nextjs.raw.integrations.recharts.CartesianGrid;
import nextjs.raw.integrations.recharts.ChartTypes.AxisType;
import nextjs.raw.integrations.recharts.ChartTypes.BarChartLayout;
import nextjs.raw.integrations.recharts.ChartTypes.ChartMargin;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarCategoryKey;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarDatum;
import nextjs.raw.integrations.recharts.XAxis;
import nextjs.raw.integrations.recharts.YAxis;

/** Positive raw, semantic, and HXX controls for the reviewed chart shape. */
@:keep
class Positive {
	static function main():Void {}

	public static function render(rows:Array<StackedBarDatum>):Element {
		final model = StackedBars.create(rows, "Open", "var(--open)", "Filed", "var(--filed)");
		final margin:ChartMargin = {
			top: 8,
			right: 8,
			bottom: 8,
			left: 0
		};
		return
			<BarChart data={model.rows} responsive={true} accessibilityLayer={true} layout={BarChartLayout.Vertical} className="priority-runway" desc="Open and filed work grouped by priority." margin={margin} tabIndex={0}>
			<CartesianGrid horizontal={false} vertical={true} stroke="var(--grid)" strokeDasharray="2 4" />
			<XAxis type={AxisType.Number} allowDecimals={false} axisLine={false} tickLine={false} tickCount={2} />
			<YAxis type={AxisType.Category} dataKey={StackedBarCategoryKey.Category} axisLine={false} tickLine={false} width={34} />
			<Bar dataKey={model.primary.key} name={model.primary.label} fill={model.primary.color} stackId="work" barSize={18} isAnimationActive={false} />
			<Bar dataKey={model.secondary.key} name={model.secondary.label} fill={model.secondary.color} stackId="work" barSize={18} isAnimationActive={false} />
		</BarChart>;
	}

	public static function rows():Array<StackedBarDatum> {
		return [StackedBars.row("P0", 2, 1), StackedBars.row("P1", 1, 3)];
	}
}
