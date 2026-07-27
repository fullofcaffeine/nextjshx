package route_handlers.negative;

import nextjs.raw.server.NextRequest;
import nextjs.raw.server.WebResponse;
import nextjs.route.RouteContext;

@:next.route("api/@modal/negative/[id]")
class ParallelRouteHandler {
	@:next.GET
	public static function get(request:NextRequest, context:RouteContext<IdParams>):WebResponse {
		return new WebResponse("never");
	}
}
