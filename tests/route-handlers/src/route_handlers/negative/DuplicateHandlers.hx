package route_handlers.negative;

import nextjs.raw.server.NextRequest;
import nextjs.raw.server.WebResponse;
import nextjs.route.RouteContext;
import route_handlers.negative.Types.CorrectParams;

@:next.route("api/negative/[id]")
class DuplicateHandlers {
	@:next.GET
	public static function first(request:NextRequest, context:RouteContext<CorrectParams>):WebResponse {
		return new WebResponse("first");
	}

	@:next.GET
	public static function second(request:NextRequest, context:RouteContext<CorrectParams>):WebResponse {
		return new WebResponse("second");
	}
}
