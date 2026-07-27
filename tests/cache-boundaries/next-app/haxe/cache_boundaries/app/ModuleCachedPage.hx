package cache_boundaries.app;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.raw.Cache;
import nextjs.raw.cache.CacheTypes.CacheLifeProfile;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

/** The zero-argument annotation caches the generated page module itself. */
@:next.page("module-cache")
@:next.cache
class ModuleCachedPage {
	@:async
	public static function render(_props:PageProps<NoParams, SearchParams>):Promise<Element> {
		Cache.cacheLife(CacheLifeProfile.Hours);
		Cache.cacheTag("nextjshx-module-cache-proof");
		return <main><h1>Module cache adapter</h1></main>;
	}
}
