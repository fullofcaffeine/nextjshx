package proxy_fixture.negative;

import nextjs.raw.server.NextMiddleware.NextMiddlewareResult;
import nextjs.raw.server.NextRequest;

@:next.page("conflict")
@:next.proxy
class BoundaryConflict {
	public static function proxy(request:NextRequest):NextMiddlewareResult {
		return null;
	}
}
