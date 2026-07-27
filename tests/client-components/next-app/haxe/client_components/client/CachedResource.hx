package client_components.client;

import nextjs.client.CachedPromise;

/** Reviewed fixture provider whose module-level Promise has stable identity. */
extern class CachedResource {
	@:jsRequire("@nextjshx/client-fixture-hook", "cachedSecondaryLabels")
	static function labels():Array<CachedPromise<String>>;
}
