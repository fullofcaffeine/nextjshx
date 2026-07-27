package next_server;

import genes.js.Async.await;
import genes.ts.Undefinable;
import genes.ts.Unknown;
import haxe.extern.EitherType;
import js.lib.Promise;
import nextjs.raw.Cache;
import nextjs.raw.Headers;
import nextjs.raw.Server;
import nextjs.raw.cache.CacheTypes.CacheLifeProfile;
import nextjs.raw.cache.CacheTypes.RevalidatePathType;
import nextjs.raw.cache.CacheTypes.RevalidationDisabled;
import nextjs.raw.headers.CookieTypes.CookiePriority;
import nextjs.raw.headers.CookieTypes.CookieSameSite;
import nextjs.raw.server.MiddlewareConfig;
import nextjs.raw.server.MiddlewareConfig.MatcherHostSource;
import nextjs.raw.server.MiddlewareConfig.MatcherCondition;
import nextjs.raw.server.MiddlewareConfig.MatcherHostCondition;
import nextjs.raw.server.MiddlewareConfig.MatcherKeySource;
import nextjs.raw.server.MiddlewareConfig.MatcherKeyCondition;
import nextjs.raw.server.MiddlewareConfig.MatcherLocaleDisabled;
import nextjs.raw.server.MiddlewareConfig.ProxyMatcher;
import nextjs.raw.server.NextFetchEvent;
import nextjs.raw.server.NextMiddleware;
import nextjs.raw.server.NextMiddleware.NextMiddlewareResult;
import nextjs.raw.server.NextProxy;
import nextjs.raw.server.NextRequest;
import nextjs.raw.server.NextResponse;
import nextjs.raw.server.ProxyConfig;
import nextjs.raw.server.URLPattern;
import nextjs.raw.server.WebFormData;
import nextjs.raw.server.WebRequest;
import nextjs.raw.server.WebResponse;

/** Strict direct-import and route-handler parity fixture for B05. */
@:keep
class ServerConsumer {
	static function main():Void {
		cacheCalls();
		serverCalls();
		formDataCalls();
		consume(route(new NextRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"user-agent": "NextJsHx fixture"},
			duplex: RequestDuplex.Half
		})));
		consume(web(new WebRequest("https://example.test/api")));
		consume(new WebResponse("ready", {status: 202}));
		consume(new URLPattern({pathname: "/api/:resource/:id"}).test("https://example.test/api/todos/42"));
		consume(config());
		consume(proxyConfig());
		consume(proxy());
		consume(middleware());
	}

	static function formDataCalls():Void {
		final source = new WebFormData();
		final clone = new WebFormData();
		source.append("title", "Typed boundary");
		source.forEach((value, name, _source) -> clone.appendEntry(name, value));
		consume(clone);
	}

	static function cacheCalls():Void {
		Cache.cacheLife(CacheLifeProfile.Minutes);
		Cache.cacheLife({stale: 30, revalidate: 60, expire: 3600});
		Cache.cacheLife(CacheLifeProfile.custom("inventory"));
		Cache.cacheTag("todos", "tenant:42");
		Cache.refresh();
		Cache.revalidatePath("/todos", RevalidatePathType.Page);
		Cache.revalidateTag("todos", CacheLifeProfile.Max);
		Cache.updateTag("todos");
		Cache.unstable_cacheLife(CacheLifeProfile.Hours);
		Cache.unstable_cacheTag("legacy");
		Cache.unstable_noStore();

		final callback:String->Promise<String> = value -> Promise.resolve(value);
		final cached:String->Promise<String> = Cache.unstable_cache(callback, ["typed"], {
			revalidate: RevalidationDisabled.Disabled,
			tags: ["todos"]
		});
		consume(cached("value"));
	}

	static function serverCalls():Void {
		Server.after(Promise.resolve("logged"));
		Server.after(() -> "logged");
		consume(Server.connection());
		consume(Server.userAgentFromString("NextJsHx fixture").browser.name);
		consume(Server.userAgentFromString(Undefinable.absent()).isBot);

		final browserHeaders = new js.html.Headers();
		browserHeaders.set("user-agent", "NextJsHx fixture");
		consume(Server.userAgent({headers: browserHeaders}).ua);
	}

	@:async
	public static function route(request:NextRequest):Promise<WebResponse> {
		final requestHeaders = await(Headers.headers());
		consume(requestHeaders.get("authorization"));

		final readCookies = await(Headers.cookies());
		consume(readCookies.get("session"));

		final mutableCookies = await(Headers.mutableCookies());
		mutableCookies.set("theme", "dark", {
			httpOnly: true,
			priority: CookiePriority.High,
			sameSite: CookieSameSite.Lax
		});
		mutableCookies.delete("legacy");

		final draft = await(Headers.draftMode());
		if (draft.isEnabled) {
			draft.disable();
		} else {
			draft.enable();
		}

		consume(request.cookies.get("request-cookie"));
		consume(request.nextUrl.pathname);
		consumeUnknown(await(request.json()));

		final response = NextResponse.json({ok: true, path: request.nextUrl.pathname}, {status: 201});
		response.cookies.set("created", "1", {httpOnly: true});
		consume(await(response.json()));
		consume(NextResponse.redirect("https://example.test/todos", 307));
		consume(NextResponse.rewrite("https://example.test/todos"));
		consume(NextResponse.next({request: {headers: request.headers}}));
		return response;
	}

	@:async
	static function web(request:WebRequest):Promise<WebResponse> {
		consumeUnknown(await(request.json()));
		return new WebResponse("ok", {status: 200});
	}

	static function config():MiddlewareConfig {
		final tenantValue:MatcherKeyCondition = {type: MatcherKeySource.Header, key: "x-tenant"};
		final hostValue:MatcherHostCondition = {type: MatcherHostSource.Host, value: "example.test"};
		final tenant:MatcherCondition = tenantValue;
		final host:MatcherCondition = hostValue;
		final matcher:ProxyMatcher = {
			source: "/api/:path*",
			locale: MatcherLocaleDisabled.Disabled,
			has: [tenant, host]
		};
		final matchers:Array<EitherType<String, ProxyMatcher>> = [matcher, "/health"];
		return {matcher: matchers, regions: ["iad1", "cdg1"]};
	}

	static function proxyConfig():ProxyConfig {
		return {matcher: "/api/:path*", unstable_allowDynamic: ["**/*.js"]};
	}

	static function proxy():NextProxy {
		return (request:NextRequest, event:NextFetchEvent) -> {
			event.waitUntil(Promise.resolve("audit"));
			final result:NextMiddlewareResult = NextResponse.next({request: {headers: request.headers}});
			return result;
		};
	}

	static function middleware():NextMiddleware {
		return (request:NextRequest, event:NextFetchEvent) -> {
			event.passThroughOnException();
			final result:NextMiddlewareResult = request.nextUrl.pathname == "/skip" ? null : NextResponse.next();
			return result;
		};
	}

	static function consumeUnknown(_:Unknown):Void {}

	static function consume<T>(_:T):Void {}
}
