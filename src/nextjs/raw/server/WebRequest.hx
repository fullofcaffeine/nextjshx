package nextjs.raw.server;

import genes.ts.Unknown;
import haxe.extern.EitherType;
import js.lib.Promise;

/** Header initializer accepted by the Web Fetch constructors. */
@:ts.type("globalThis.HeadersInit")
typedef WebHeadersInit = EitherType<js.html.Headers, EitherType<Array<Array<String>>, haxe.DynamicAccess<String>>>;

typedef WebRequestInitFields = {
	@:ts.optional
	@:optional var method:String;
	@:ts.optional
	@:optional var body:WebRequestBody;
	@:ts.optional
	@:optional var headers:WebHeadersInit;
	@:ts.optional
	@:optional var signal:js.html.AbortSignal;
}

/** Common non-streaming request bodies used by JSON, form, and query tests. */
typedef WebRequestBody = EitherType<String, EitherType<WebFormData, WebSearchParams>>;

/** Typed subset of the standard Request constructor options used by handlers. */
@:ts.type("globalThis.RequestInit")
abstract WebRequestInit(WebRequestInitFields) from WebRequestInitFields {}

/** URL-like inputs accepted by the standard Request constructor. */
typedef WebRequestInput = EitherType<String, EitherType<js.html.URL, EitherType<WebRequest, js.html.Request>>>;

/**
 * Safe native view of the Web Request contract.
 *
 * Haxe 4.3.7 exposes `json()` as `Dynamic`. The runtime is still the platform
 * Request object, but the generated TypeScript and Haxe views use `unknown` so
 * application code must decode untrusted request bodies explicitly.
 */
@:native("Request")
@:ts.type("Omit<globalThis.Request, 'json'> & { json(): Promise<unknown> }")
extern class WebRequest {
	final bodyUsed:Bool;
	final cache:js.html.RequestCache;
	final credentials:js.html.RequestCredentials;
	final destination:js.html.RequestDestination;
	final headers:js.html.Headers;
	final integrity:String;
	final method:String;
	final mode:js.html.RequestMode;
	final redirect:js.html.RequestRedirect;
	final referrer:String;
	final referrerPolicy:js.html.ReferrerPolicy;
	final signal:js.html.AbortSignal;
	final url:String;

	function new(input:WebRequestInput, ?init:WebRequestInit):Void;
	function arrayBuffer():Promise<js.lib.ArrayBuffer>;
	function blob():Promise<js.html.Blob>;
	function clone():WebRequest;
	function formData():Promise<WebFormData>;
	function json():Promise<Unknown>;
	function text():Promise<String>;
}
