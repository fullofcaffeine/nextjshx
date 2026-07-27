package nextjs.raw.server;

import nextjs.raw.headers.CookieTypes.RequestCookies;
import nextjs.raw.server.WebRequest.WebHeadersInit;
import nextjs.raw.server.WebRequest.WebRequestBody;
import nextjs.raw.server.WebRequest.WebRequestInput;

/** Closed request-body streaming mode currently accepted by Next. */
@:ts.type("'half'")
enum abstract RequestDuplex(String) to String {
	final Half = "half";
}

typedef NextRequestInitFields = {
	@:ts.optional
	@:optional var method:String;
	@:ts.optional
	@:optional var body:WebRequestBody;
	@:ts.optional
	@:optional var headers:WebHeadersInit;
	@:ts.optional
	@:optional var signal:js.html.AbortSignal;
	@:ts.optional
	@:optional var duplex:RequestDuplex;
}

/** Typed, application-facing subset of the public Next request initializer. */
@:ts.type("NonNullable<ConstructorParameters<typeof import('next/server').NextRequest>[1]>")
abstract NextRequestInit(NextRequestInitFields) from NextRequestInitFields {}

/**
 * Next's extended Web Request with a safe JSON decode boundary.
 *
 * `json()` deliberately remains `Unknown`: request bodies are untrusted even
 * when the route that received them is statically typed.
 */
@:jsRequire("next/server", "NextRequest")
@:ts.type("Omit<import('next/server').NextRequest, 'json'> & { json(): Promise<unknown> }")
extern class NextRequest extends WebRequest {
	final cookies:RequestCookies;
	final nextUrl:NextUrl;

	function new(input:WebRequestInput, ?init:NextRequestInit):Void;
}
