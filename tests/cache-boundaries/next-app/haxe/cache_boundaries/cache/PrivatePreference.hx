package cache_boundaries.cache;

import genes.js.Async.await;
import js.lib.Promise;
import nextjs.raw.Headers;

/** Explicit private capability proof; ordinary caching rejects this request read. */
@:next.cachePrivate("experimental/preference")
class PrivatePreference {
	@:async
	public static function read(fallback:String):Promise<String> {
		final cookie = (await(Headers.cookies())).get("nextjshx-preference").orNull();
		return cookie == null ? fallback : cookie.value;
	}
}
