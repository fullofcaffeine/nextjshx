package nextjs.raw.metadata;

/** The fully resolved parent viewport value supplied by Next. */
@:ts.type("Awaited<import('next').ResolvingViewport>")
extern class ResolvedViewport {}

/** Promise for a parent viewport in a `generateViewport` function. */
@:ts.type("import('next').ResolvingViewport")
typedef ResolvingViewport = js.lib.Promise<ResolvedViewport>;
