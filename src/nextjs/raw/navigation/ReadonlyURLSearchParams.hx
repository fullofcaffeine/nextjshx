package nextjs.raw.navigation;

import js.lib.Iterator;
import nextjs.raw.types.Tuple2;

/**
 * A single key/value pair produced by `ReadonlyURLSearchParams.entries()`.
 *
 * The shared zero-runtime tuple preserves both positional string types in Haxe
 * and emits the public Next/DOM `[string, string]` contract in TypeScript. An
 * `Array<String>` would lose the fixed length and distinct checked slots.
 */
typedef SearchParamEntry = Tuple2<String, String>;

/**
 * Read-only Haxe view of Next's URL search parameters.
 *
 * Next's JavaScript class inherits mutation methods that throw at runtime.
 * Omitting those methods turns that runtime trap into an earlier Haxe error
 * while the TypeScript projection retains the exact public Next type.
 */
@:ts.type("import('next/navigation').ReadonlyURLSearchParams")
extern class ReadonlyURLSearchParams {
	final size:Int;
	function get(name:String):Null<String>;
	function getAll(name:String):Array<String>;
	function has(name:String, ?value:String):Bool;
	function entries():Iterator<SearchParamEntry>;
	function keys():Iterator<String>;
	function values():Iterator<String>;
	function forEach(callback:(value:String, key:String) -> Void):Void;
	function toString():String;
}
