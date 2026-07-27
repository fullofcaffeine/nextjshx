package proxy_fixture.positive;

import js.lib.Promise;
import nextjs.proxy.ProxyRequest;
import nextjs.proxy.ProxyResponse;
import nextjs.raw.server.NextFetchEvent;

@:next.proxy
@:next.matcher("/products/:path*", "/haxe")
class RequestProxy {
	public static function proxy(request:ProxyRequest, event:NextFetchEvent):Promise<ProxyResponse> {
		event.waitUntil(Promise.resolve(request.nextUrl.pathname));
		return Promise.resolve(ProxyResponse.next());
	}
}
