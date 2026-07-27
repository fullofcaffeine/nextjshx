package nextjs.app;

import js.lib.Promise;

/**
 * Haxe-facing props for one App Router page declaration.
 *
 * The declaration macro validates `Params` against the annotated route and
 * currently requires `Query` to be the faithful raw `SearchParams` shape.
 * Both values remain Promise-shaped to match current Next.js behavior.
 */
typedef PageProps<Params, Query> = {
	final params:Promise<Params>;
	final searchParams:Promise<Query>;
}
