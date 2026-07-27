package route_handlers.negative;

import nextjs.raw.server.NextRequest;
import nextjs.raw.server.WebResponse;
import route_handlers.negative.Types.StructuralContext;

@:next.route("api/negative/[id]")
class NonRouteContextHandler {
	@:next.GET
	public static function get(request:NextRequest, context:StructuralContext):WebResponse {
		return new WebResponse("context");
	}
}
