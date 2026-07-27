package nextjs.raw.server;

import genes.ts.Unknown;
import haxe.extern.EitherType;
import js.lib.Promise;
import nextjs.raw.headers.CookieTypes.ResponseCookies;
import nextjs.raw.server.WebRequest.WebHeadersInit;
import nextjs.raw.server.WebResponse.WebResponseBody;

typedef NextResponseInitFields = {
	@:ts.optional
	@:optional var headers:WebHeadersInit;
	@:ts.optional
	@:optional var status:Int;
	@:ts.optional
	@:optional var statusText:String;
	@:ts.optional
	@:optional var url:String;
}

/** Public response initialization fields used by constructors and redirects. */
@:ts.type("NonNullable<ConstructorParameters<typeof import('next/server').NextResponse>[1]>")
abstract NextResponseInit(NextResponseInitFields) from NextResponseInitFields {}

typedef MiddlewareResponseInitFields = {
	@:ts.optional
	@:optional var headers:WebHeadersInit;
	@:ts.optional
	@:optional var status:Int;
	@:ts.optional
	@:optional var statusText:String;
	@:ts.optional
	@:optional var request:{
		@:ts.optional
		@:optional var headers:js.html.Headers;
	};
}

/** Response options that can override the forwarded request headers. */
@:ts.type("NonNullable<Parameters<typeof import('next/server').NextResponse.next>[0]>")
abstract MiddlewareResponseInit(MiddlewareResponseInitFields) from MiddlewareResponseInitFields {}

typedef NextResponseDestination = EitherType<String, EitherType<NextUrl, js.html.URL>>;
typedef NextRedirectInit = EitherType<Int, NextResponseInit>;

/**
 * Public Next response with unknown JSON for externally sourced instances.
 */
@:jsRequire("next/server", "NextResponse")
@:ts.type("Omit<import('next/server').NextResponse<unknown>, 'json'> & { json(): Promise<unknown> }")
extern class NextResponse extends WebResponse {
	final cookies:ResponseCookies;

	function new(?body:WebResponseBody, ?init:NextResponseInit):Void;
	static function json<JsonBody>(body:JsonBody, ?init:NextResponseInit):NextResponseBody<JsonBody>;
	static function next(?init:MiddlewareResponseInit):NextResponse;
	static function redirect(url:NextResponseDestination, ?init:NextRedirectInit):NextResponse;
	static function rewrite(destination:NextResponseDestination, ?init:MiddlewareResponseInit):NextResponse;
	function json():Promise<Unknown>;
}

/** Typed JSON response produced locally by `NextResponse.json`. */
@:ts.type("Omit<import('next/server').NextResponse<$0>, 'json'> & { json(): Promise<$0> }")
extern class NextResponseBody<Body> extends NextResponse {
	function json():Promise<Body>;
}
