package nextjs.raw.headers;

import js.lib.Iterator;

/** A single name/value entry produced by the Headers iterator. */
@:ts.type("[string, string]")
typedef HeaderEntry = Array<String>;

/**
 * Read-only Haxe view of Next's async request headers.
 *
 * Next retains deprecated mutators that throw at runtime. Omitting them turns
 * that trap into an immediate Haxe diagnostic.
 */
@:ts.type("Omit<Awaited<ReturnType<typeof import('next/headers').headers>>, 'append' | 'set' | 'delete'>")
extern class ReadonlyHeaders {
	function entries():Iterator<HeaderEntry>;
	function forEach(callback:(value:String, key:String) -> Void):Void;
	function get(name:String):Null<String>;
	function getSetCookie():Array<String>;
	function has(name:String):Bool;
	function keys():Iterator<String>;
	function values():Iterator<String>;
}
