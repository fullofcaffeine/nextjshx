package recharts_fixture;

import genes.react.Element;
import nextjs.raw.integrations.recharts.Bar;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarCategoryKey;

class CategoryAsSeries {
	static function main():Void {
		render();
	}

	public static function render():Element {
		return <Bar dataKey={StackedBarCategoryKey.Category} />;
	}
}
