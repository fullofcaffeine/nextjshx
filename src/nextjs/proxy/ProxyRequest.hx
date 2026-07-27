package nextjs.proxy;

import genes.ts.Undefinable;
import genes.ts.Unknown;
import js.lib.Promise;

/** One request-cookie entry exposed without pulling the complete Web API graph. */
typedef ProxyCookie = {
	final name:String;
	final value:String;
}

/** Read-only header operations useful at the request interception boundary. */
@:ts.type("import('next/server').NextRequest['headers']")
extern class ProxyRequestHeaders {
	function get(name:String):Null<String>;
	function getSetCookie():Array<String>;
	function has(name:String):Bool;
}

/** Cookie reads useful at the request interception boundary. */
@:ts.type("import('next/server').NextRequest['cookies']")
extern class ProxyRequestCookies {
	final size:Int;
	function get(name:String):Undefinable<ProxyCookie>;
	function getAll(?name:String):Array<ProxyCookie>;
	function has(name:String):Bool;
	function toString():String;
}

/** Focused URL view for common proxy matching and rewrite decisions. */
@:ts.type("import('next/server').NextRequest['nextUrl']")
extern class ProxyUrl {
	var hash:String;
	var host:String;
	var hostname:String;
	var href:String;
	final origin:String;
	var pathname:String;
	var port:String;
	var protocol:String;
	var search:String;

	function clone():ProxyUrl;
	function toString():String;
}

/**
 * Ergonomic request view for `@:next.proxy` implementations.
 *
 * The emitted TypeScript remains Next's full public request type. Haxe exposes
 * the commonly useful read surface and keeps JSON as an explicit unknown
 * decode boundary; import raw `NextRequest` when an advanced Web API member is
 * genuinely required.
 */
@:ts.type("Omit<import('next/server').NextRequest, 'json'> & { json(): Promise<unknown> }")
extern class ProxyRequest {
	final cookies:ProxyRequestCookies;
	final headers:ProxyRequestHeaders;
	final method:String;
	final nextUrl:ProxyUrl;
	final url:String;

	function json():Promise<Unknown>;
	function text():Promise<String>;
}
