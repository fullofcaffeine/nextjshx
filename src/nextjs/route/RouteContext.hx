package nextjs.route;

import js.lib.Promise;

/**
 * Haxe-native Route Handler context with Next's asynchronous params contract.
 *
 * The route declaration macro validates `Params` against the annotated route
 * path. Authors can therefore await a discoverable typed value while the
 * generated adapter independently checks Next's `RouteContext<"/path">`.
 */
typedef RouteContext<Params> = {
	final params:Promise<Params>;
}
