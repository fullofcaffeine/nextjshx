package nextjs.raw.server;

import haxe.extern.EitherType;
import js.lib.Iterator;

typedef WebFormDataEntry = EitherType<String, js.html.Blob>;

/**
 * Native FormData with current DOM semantics instead of Haxe 4.3.7's legacy
 * `Directory` union and Dynamic iterator callbacks.
 */
@:native("FormData")
@:ts.type("globalThis.FormData")
extern class WebFormData {
	function new():Void;
	@:overload(function(name:String, value:js.html.Blob, ?filename:String):Void {})
	function append(name:String, value:String):Void;
	@:native("append")
	function appendEntry(name:String, value:WebFormDataEntry, ?filename:String):Void;
	function delete(name:String):Void;
	function forEach(callback:(value:WebFormDataEntry, name:String, source:WebFormData) -> Void):Void;
	function get(name:String):Null<WebFormDataEntry>;
	function getAll(name:String):Array<WebFormDataEntry>;
	function has(name:String):Bool;
	function keys():Iterator<String>;
	@:overload(function(name:String, value:js.html.Blob, ?filename:String):Void {})
	function set(name:String, value:String):Void;
}
