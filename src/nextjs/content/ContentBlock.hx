package nextjs.content;

/**
 * Closed portable content algebra.
 *
 * Adding a block kind makes every renderer switch non-exhaustive until it is
 * handled, keeping backend payloads and frontend presentation in lockstep.
 */
enum ContentBlock {
	Heading(block:HeadingBlock);
	Prose(block:ProseBlock);
	Callout(block:CalloutBlock);
	Quote(block:QuoteBlock);
	Code(block:CodeBlock);
	DataSeries(block:DataSeriesBlock);
	Media(block:MediaBlock);
	Metric(block:MetricBlock);
}
