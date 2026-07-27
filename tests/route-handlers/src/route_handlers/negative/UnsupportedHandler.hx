package route_handlers.negative;

import nextjs.raw.server.NextRequest;
import nextjs.raw.server.WebResponse;
import nextjs.route.RouteContext;
import route_handlers.negative.Types.CorrectParams;

@:next.route("api/negative/[id]")
class UnsupportedHandler {
	@:next.TRACE
	public static function trace(request:NextRequest, context:RouteContext<CorrectParams>):WebResponse {
		return new WebResponse("trace");
	}
}
