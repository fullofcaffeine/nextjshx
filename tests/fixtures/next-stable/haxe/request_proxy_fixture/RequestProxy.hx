package request_proxy_fixture;

import nextjs.proxy.ProxyRequest;
import nextjs.proxy.ProxyResponse;

@:next.proxy
@:next.matcher("/products/:path*", "/haxe")
class RequestProxy {
	public static function proxy(request:ProxyRequest):ProxyResponse {
		final response = ProxyResponse.next();
		response.headers.set("x-nextjshx-proxy", request.nextUrl.pathname);
		return response;
	}
}
