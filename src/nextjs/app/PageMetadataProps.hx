package nextjs.app;

import js.lib.Promise;

/** Page-specific `generateMetadata` props with Promise-shaped search params. */
typedef PageMetadataProps<Params, Query> = {
	final params:Promise<Params>;
	final searchParams:Promise<Query>;
}
