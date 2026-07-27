package route_handlers.positive;

import js.lib.Promise;
import nextjs.raw.server.NextRequest;
import nextjs.raw.server.NextResponse;
import nextjs.raw.server.NextResponse.NextResponseBody;
import nextjs.raw.server.WebResponse;
import nextjs.route.RouteContext;

typedef EchoParams = {
	final id:String;
}

typedef EchoPayload = {
	final method:String;
	final id:String;
}

@:next.route("api/(v1)/echo/[id]")
class EchoHandlers {
	@:next.GET
	public static function get(request:NextRequest, context:RouteContext<EchoParams>):Promise<WebResponse> {
		return context.params.then(params -> new WebResponse('GET:${params.id}'));
	}

	@:next.POST
	public static function post(request:NextRequest, context:RouteContext<EchoParams>):Promise<NextResponseBody<EchoPayload>> {
		return context.params.then(params -> NextResponse.json({method: "POST", id: params.id}));
	}

	@:next.DELETE
	public static function remove(request:NextRequest, context:RouteContext<EchoParams>):WebResponse {
		return new WebResponse("DELETE");
	}
}
