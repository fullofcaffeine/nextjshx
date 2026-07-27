package proxy_fixture.negative;

import nextjs.raw.server.NextMiddleware.NextMiddlewareResult;
import nextjs.raw.server.NextRequest;

@:next.proxy
class ExtraPublic {
	public static final config:String = "unreviewed";

	public static function proxy(request:NextRequest):NextMiddlewareResult {
		return null;
	}
}
