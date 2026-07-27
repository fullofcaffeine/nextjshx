package proxy_fixture.negative;

import nextjs.raw.server.NextMiddleware.NextMiddlewareResult;
import nextjs.raw.server.NextRequest;

@:next.proxy
@:next.matcher("/private", "/private")
class DuplicateMatcher {
	public static function proxy(request:NextRequest):NextMiddlewareResult {
		return null;
	}
}
