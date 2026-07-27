package route_handler_fixture;

import js.lib.Promise;
import nextjs.codec.ResponseJson;
import nextjs.raw.server.NextRequest;
import nextjs.raw.server.NextResponse.NextResponseBody;
import nextjs.raw.server.WebResponse;
import nextjs.route.RouteContext;

typedef EchoRouteParams = {
	final id:String;
}

typedef EchoRoutePayload = {
	final method:String;
	final id:String;
}

/** A real Next production Route Handler authored and validated in Haxe. */
@:next.route("api/echo/[id]")
class EchoRoute {
	@:next.GET
	public static function get(request:NextRequest, context:RouteContext<EchoRouteParams>):Promise<WebResponse> {
		return context.params.then(params -> new WebResponse('GET:${params.id}'));
	}

	@:next.POST
	public static function post(request:NextRequest, context:RouteContext<EchoRouteParams>):Promise<NextResponseBody<EchoRoutePayload>> {
		return context.params.then(params -> ResponseJson.ok({method: "POST", id: params.id}));
	}

	@:next.DELETE
	public static function remove(request:NextRequest, context:RouteContext<EchoRouteParams>):WebResponse {
		return new WebResponse("DELETE");
	}
}
