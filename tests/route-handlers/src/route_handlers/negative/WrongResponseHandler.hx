package route_handlers.negative;

import nextjs.raw.server.NextRequest;
import nextjs.route.RouteContext;
import route_handlers.negative.Types.CorrectParams;

@:next.route("api/negative/[id]")
class WrongResponseHandler {
	@:next.GET
	public static function get(request:NextRequest, context:RouteContext<CorrectParams>):String {
		return "not a response";
	}
}
