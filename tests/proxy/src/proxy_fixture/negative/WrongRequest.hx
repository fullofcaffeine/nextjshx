package proxy_fixture.negative;

import nextjs.raw.server.NextMiddleware.NextMiddlewareResult;

@:next.proxy
class WrongRequest {
	public static function proxy(request:String):NextMiddlewareResult {
		return null;
	}
}
