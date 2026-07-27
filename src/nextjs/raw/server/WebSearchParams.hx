package nextjs.raw.server;

import js.lib.Iterator;

/** Native URLSearchParams with accurately typed iterators for Haxe 4.3.7. */
@:native("URLSearchParams")
@:ts.type("globalThis.URLSearchParams")
extern class WebSearchParams {
	function new(init:String = ""):Void;
	function append(name:String, value:String):Void;
	function delete(name:String):Void;
	function get(name:String):Null<String>;
	function getAll(name:String):Array<String>;
	function has(name:String, ?value:String):Bool;
	function set(name:String, value:String):Void;
	function sort():Void;
	function keys():Iterator<String>;
	function toString():String;
}
