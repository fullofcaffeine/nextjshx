package cache_boundaries.routes;

import cache_boundaries.cache.CachedCounter;
import cache_boundaries.cache.CachedCounter.CacheSample;
import js.lib.Promise;
import nextjs.cache.CacheFunction;
import nextjs.codec.ResponseJson;
import nextjs.raw.Cache;
import nextjs.raw.server.NextRequest;
import nextjs.raw.server.NextResponse.NextResponseBody;
import nextjs.raw.server.WebResponse;
import nextjs.route.NoParams;
import nextjs.route.RouteContext;

typedef InvalidationReceipt = {
	final ok:Bool;
}

/** Request input is read outside the shared cache and passed as a plain key. */
@:next.route("api/cache")
class CacheApi {
	@:next.GET
	public static function get(request:NextRequest, _context:RouteContext<NoParams>):Promise<NextResponseBody<CacheSample>> {
		final requested = request.nextUrl.searchParams.get("key");
		final key = requested == null || StringTools.trim(requested) == "" ? "default" : requested;
		final read = CacheFunction.ref(CachedCounter.read);
		return read(key).then(sample -> ResponseJson.ok(sample));
	}

	@:next.POST
	public static function invalidate(_request:NextRequest, _context:RouteContext<NoParams>):Promise<NextResponseBody<InvalidationReceipt>> {
		Cache.revalidateTag("nextjshx-cache-proof", {expire: 0});
		return Promise.resolve(ResponseJson.ok({ok: true}));
	}
}
