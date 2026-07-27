package nextjs.content;

/** Supported editorial heading depth for portable content. */
enum abstract HeadingLevel(Int) to Int {
	final Section = 2;
	final Subsection = 3;
	final Detail = 4;
}
