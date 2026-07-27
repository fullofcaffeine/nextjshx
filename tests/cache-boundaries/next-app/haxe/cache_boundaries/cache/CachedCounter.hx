package cache_boundaries.cache;

import js.lib.Promise;
import nextjs.raw.Cache;
import nextjs.raw.cache.CacheTypes.CacheLifeProfile;

typedef CacheSample = {
	final key:String;
	final invocation:Int;
}

/** Shared cache proof: the request-derived key arrives as a plain argument. */
@:next.cache("runtime/counter")
class CachedCounter {
	static var invocations:Int = 0;

	@:async
	public static function read(key:String):Promise<CacheSample> {
		Cache.cacheLife(CacheLifeProfile.Hours);
		Cache.cacheTag("nextjshx-cache-proof");
		invocations++;
		return {key: key, invocation: invocations};
	}
}
