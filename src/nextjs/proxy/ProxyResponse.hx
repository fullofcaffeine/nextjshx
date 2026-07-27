package nextjs.proxy;

import genes.ts.Unknown;
import js.lib.Promise;

/** Mutable response-header operations used by request proxies. */
@:ts.type("import('next/server').NextResponse['headers']")
extern class ProxyResponseHeaders {
	function append(name:String, value:String):Void;
	function delete(name:String):Void;
	function get(name:String):Null<String>;
	function has(name:String):Bool;
	function set(name:String, value:String):Void;
}

/**
 * Focused response view for the common continue-and-adjust proxy path.
 *
 * Runtime construction is Next's native `NextResponse.next()`. The raw
 * `nextjs.raw.server.NextResponse` binding remains available for redirects,
 * rewrites, typed JSON, and advanced initialization.
 */
@:jsRequire("next/server", "NextResponse")
@:ts.type("Omit<import('next/server').NextResponse<unknown>, 'json'> & { json(): Promise<unknown> }")
extern class ProxyResponse {
	final headers:ProxyResponseHeaders;

	static function next():ProxyResponse;
	function json():Promise<Unknown>;
}
