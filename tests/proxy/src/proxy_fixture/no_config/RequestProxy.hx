package proxy_fixture.no_config;

import nextjs.proxy.ProxyRequest;
import nextjs.proxy.ProxyResponse;

@:next.proxy
class RequestProxy {
	public static function proxy(request:ProxyRequest):ProxyResponse {
		return ProxyResponse.next();
	}
}
