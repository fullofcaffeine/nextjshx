package client_components_negative;

import nextjs.client.CachedPromise;

typedef ReviewedState = {
	final count:Int;
}

/** Precisely reviewed native Hook used by the placement controls. */
extern class ReviewedHooks {
	@:next.hook
	@:jsRequire("react", "useState")
	static function useCount():ReviewedState;
}

/** Stable-identity resource used to isolate React use placement failures. */
extern class NegativeCachedResource {
	@:jsRequire("fixture", "cachedLabel")
	static function label():CachedPromise<String>;
}
