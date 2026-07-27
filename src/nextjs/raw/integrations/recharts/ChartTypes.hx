package nextjs.raw.integrations.recharts;

/** Closed two-series datum supported by the reviewed Recharts subset. */
typedef StackedBarDatum = {
	final category:String;
	final primary:Int;
	final secondary:Int;
}

/** Exact chart orientation literals accepted by the reviewed subset. */
enum abstract BarChartLayout(String) {
	final Horizontal = "horizontal";
	final Vertical = "vertical";
}

/** Exact axis-domain literals accepted by the reviewed subset. */
enum abstract AxisType(String) {
	final Category = "category";
	final Number = "number";
}

/** The fixed category field in `StackedBarDatum`. */
enum abstract StackedBarCategoryKey(String) {
	final Category = "category";
}

/** The two numeric fields in `StackedBarDatum`; category is not a series. */
enum abstract StackedBarSeriesKey(String) {
	final Primary = "primary";
	final Secondary = "secondary";
}

/** Supported numeric chart margins. */
typedef ChartMargin = {
	final top:Int;
	final right:Int;
	final bottom:Int;
	final left:Int;
}
