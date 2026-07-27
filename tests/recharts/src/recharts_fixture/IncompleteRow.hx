package recharts_fixture;

import nextjs.raw.integrations.recharts.ChartTypes.StackedBarDatum;

class IncompleteRow {
	public static final row:StackedBarDatum = {category: "P0", primary: 2};

	static function main():Void {
		trace(row.category);
	}
}
