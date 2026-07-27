package proxy_fixture.negative;

import nextjs.raw.server.NextMiddleware.NextMiddlewareResult;
import nextjs.raw.server.NextRequest;

private class MatcherValue {
	public static inline final VALUE:String = "/private";
}

@:next.proxy
@:next.matcher(MatcherValue.VALUE)
class MatcherExpression {
	public static function proxy(request:NextRequest):NextMiddlewareResult {
		return null;
	}
}
