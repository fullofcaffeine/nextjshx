package nextjs.raw.metadata;

/** The fully resolved parent metadata value supplied by Next. */
@:ts.type("Awaited<import('next').ResolvingMetadata>")
extern class ResolvedMetadata {}

/** Promise for parent metadata in a `generateMetadata` function. */
@:ts.type("import('next').ResolvingMetadata")
typedef ResolvingMetadata = js.lib.Promise<ResolvedMetadata>;
