package route_handlers.negative;

import nextjs.raw.server.NextRequest;
import nextjs.raw.server.WebResponse;
import nextjs.route.RouteContext;
import route_handlers.negative.Types.WrongParams;

@:next.route("api/negative/[id]")
class WrongParamsHandler {
	@:next.GET
	public static function get(request:NextRequest, context:RouteContext<WrongParams>):WebResponse {
		return new WebResponse("params");
	}
}
