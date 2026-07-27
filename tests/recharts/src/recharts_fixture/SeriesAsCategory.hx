package recharts_fixture;

import genes.react.Element;
import nextjs.raw.integrations.recharts.ChartTypes.AxisType;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarSeriesKey;
import nextjs.raw.integrations.recharts.YAxis;

class SeriesAsCategory {
	static function main():Void {
		render();
	}

	public static function render():Element {
		return <YAxis type={AxisType.Category} dataKey={StackedBarSeriesKey.Primary} />;
	}
}
