package nextjs.integrations.recharts;

import nextjs.raw.integrations.recharts.ChartTypes.StackedBarDatum;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarSeriesKey;

/** Authored label and color for one fixed numeric series. */
typedef StackedBarSeries = {
	final key:StackedBarSeriesKey;
	final label:String;
	final color:String;
}

/** Closed model consumed by the reviewed two-series Recharts composition. */
typedef StackedBarModel = {
	final rows:Array<StackedBarDatum>;
	final primary:StackedBarSeries;
	final secondary:StackedBarSeries;
}

/**
 * Small semantic constructor for the supported two-series chart shape.
 *
 * Application code supplies useful labels, colors, and ordered rows. Series
 * keys are fixed here, so misspelled string keys never reach Recharts.
 */
class StackedBars {
	public static function create(rows:Array<StackedBarDatum>, primaryLabel:String, primaryColor:String, secondaryLabel:String,
			secondaryColor:String):StackedBarModel {
		return {
			rows: rows,
			primary: {key: StackedBarSeriesKey.Primary, label: primaryLabel, color: primaryColor},
			secondary: {key: StackedBarSeriesKey.Secondary, label: secondaryLabel, color: secondaryColor}
		};
	}

	/** Creates one exact category row without open record keys. */
	public static function row(category:String, primary:Int, secondary:Int):StackedBarDatum {
		return {category: category, primary: primary, secondary: secondary};
	}
}
