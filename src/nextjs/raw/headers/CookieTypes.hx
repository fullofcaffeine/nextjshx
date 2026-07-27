package nextjs.raw.headers;

import genes.ts.Undefinable;
import haxe.extern.EitherType;

/** Cookie name/value pair visible on an incoming request. */
typedef RequestCookie = {
	final name:String;
	final value:String;
}

/** Closed `Priority` values accepted by Set-Cookie. */
@:ts.type("'low' | 'medium' | 'high'")
enum abstract CookiePriority(String) to String {
	final Low = "low";
	final Medium = "medium";
	final High = "high";
}

/** Closed string forms of the Set-Cookie `SameSite` attribute. */
@:ts.type("'lax' | 'strict' | 'none'")
enum abstract CookieSameSite(String) to String {
	final Lax = "lax";
	final Strict = "strict";
	final None = "none";
}

/** Full response-cookie descriptor accepted by Next's mutation APIs. */
typedef ResponseCookie = {
	final name:String;
	final value:String;
	@:ts.optional
	@:optional var domain:String;
	@:ts.optional
	@:optional var path:String;
	@:ts.optional
	@:optional var secure:Bool;
	@:ts.optional
	@:optional var sameSite:EitherType<Bool, CookieSameSite>;
	@:ts.optional
	@:optional var partitioned:Bool;
	@:ts.optional
	@:optional var expires:EitherType<Float, js.lib.Date>;
	@:ts.optional
	@:optional var httpOnly:Bool;
	@:ts.optional
	@:optional var maxAge:Float;
	@:ts.optional
	@:optional var priority:CookiePriority;
}

/** Options used with the `(name, value, options)` response-cookie overload. */
typedef ResponseCookieOptions = {
	@:ts.optional
	@:optional var domain:String;
	@:ts.optional
	@:optional var path:String;
	@:ts.optional
	@:optional var secure:Bool;
	@:ts.optional
	@:optional var sameSite:EitherType<Bool, CookieSameSite>;
	@:ts.optional
	@:optional var partitioned:Bool;
	@:ts.optional
	@:optional var expires:EitherType<Float, js.lib.Date>;
	@:ts.optional
	@:optional var httpOnly:Bool;
	@:ts.optional
	@:optional var maxAge:Float;
	@:ts.optional
	@:optional var priority:CookiePriority;
}

/** Descriptor used by the object form of response-cookie deletion. */
typedef DeleteResponseCookie = {
	final name:String;
	@:ts.optional
	@:optional var domain:String;
	@:ts.optional
	@:optional var path:String;
	@:ts.optional
	@:optional var secure:Bool;
	@:ts.optional
	@:optional var sameSite:EitherType<Bool, CookieSameSite>;
	@:ts.optional
	@:optional var partitioned:Bool;
	@:ts.optional
	@:optional var httpOnly:Bool;
	@:ts.optional
	@:optional var maxAge:Float;
	@:ts.optional
	@:optional var priority:CookiePriority;
}

/**
 * Read-only view returned by the default `Headers.cookies()` binding.
 *
 * Next's public result also carries context-restricted mutation methods. They
 * are omitted here so a read site cannot accidentally compile a write.
 */
@:ts.type("Omit<Awaited<ReturnType<typeof import('next/headers').cookies>>, 'set' | 'delete'>")
extern class ReadonlyRequestCookies {
	final size:Int;
	@:overload(function(cookie:RequestCookie):Undefinable<RequestCookie> {})
	function get(name:String):Undefinable<RequestCookie>;
	@:overload(function(cookie:RequestCookie):Array<RequestCookie> {})
	function getAll(?name:String):Array<RequestCookie>;
	function has(name:String):Bool;
	function toString():String;
}

/** Explicit mutation-capable view for Server Actions and Route Handlers. */
@:ts.type("Awaited<ReturnType<typeof import('next/headers').cookies>>")
extern class MutableRequestCookies extends ReadonlyRequestCookies {
	@:overload(function(cookie:ResponseCookie):MutableRequestCookies {})
	function set(name:String, value:String, ?options:ResponseCookieOptions):MutableRequestCookies;
	@:overload(function(cookie:DeleteResponseCookie):MutableRequestCookies {})
	function delete(name:String):MutableRequestCookies;
}

/** Mutable cookie header attached directly to `NextRequest`. */
@:ts.type("import('next/server').NextRequest['cookies']")
extern class RequestCookies {
	final size:Int;
	@:overload(function(cookie:RequestCookie):Undefinable<RequestCookie> {})
	function get(name:String):Undefinable<RequestCookie>;
	@:overload(function(cookie:RequestCookie):Array<RequestCookie> {})
	function getAll(?name:String):Array<RequestCookie>;
	function has(name:String):Bool;
	@:overload(function(cookie:RequestCookie):RequestCookies {})
	function set(name:String, value:String):RequestCookies;
	function delete(names:EitherType<String, Array<String>>):EitherType<Bool, Array<Bool>>;
	function clear():RequestCookies;
	function toString():String;
}

/** Mutable Set-Cookie collection attached to `NextResponse`. */
@:ts.type("import('next/server').NextResponse['cookies']")
extern class ResponseCookies {
	@:overload(function(cookie:ResponseCookie):Undefinable<ResponseCookie> {})
	function get(name:String):Undefinable<ResponseCookie>;
	@:overload(function(cookie:ResponseCookie):Array<ResponseCookie> {})
	function getAll(?name:String):Array<ResponseCookie>;
	function has(name:String):Bool;
	@:overload(function(cookie:ResponseCookie):ResponseCookies {})
	function set(name:String, value:String, ?options:ResponseCookieOptions):ResponseCookies;
	@:overload(function(cookie:DeleteResponseCookie):ResponseCookies {})
	function delete(name:String):ResponseCookies;
	function toString():String;
}
