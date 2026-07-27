package proxy_fixture.negative;

import nextjs.raw.server.NextRequest;

@:next.proxy
class WrongReturn {
	public static function proxy(request:NextRequest):String {
		return request.nextUrl.pathname;
	}
}
