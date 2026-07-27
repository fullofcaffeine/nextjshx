package cache_boundaries_negative;

import genes.js.Async.await;
import js.lib.Promise;
import nextjs.raw.Headers;

@:next.cache("invalid/request")
class RequestApi {
	@:async
	public static function read():Promise<String> {
		final header = (await(Headers.headers())).get("x-tenant");
		return header == null ? "none" : header;
	}
}
