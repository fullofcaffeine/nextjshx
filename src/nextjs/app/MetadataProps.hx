package nextjs.app;

import js.lib.Promise;

/**
 * Safe common props supplied to `generateMetadata` for pages and layouts.
 *
 * Page-only query access uses `PageMetadataProps`; keeping it out of this
 * shared shape prevents a layout from reading a value Next never supplies.
 */
typedef MetadataProps<Params> = {
	final params:Promise<Params>;
}
