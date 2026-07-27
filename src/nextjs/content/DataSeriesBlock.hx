package nextjs.content;

/** Small display-oriented data series, independent of a charting runtime. */
typedef DataSeriesBlock = {
	final title:String;
	final unit:String;
	final points:Array<DataPoint>;
}
