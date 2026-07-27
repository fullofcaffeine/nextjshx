package nextjs.raw.server;

import genes.ts.Undefinable;
import haxe.extern.EitherType;

/** Structured URL matcher accepted by the public URLPattern constructor. */
typedef URLPatternInit = {
	@:ts.optional
	@:optional var baseURL:String;
	@:ts.optional
	@:optional var username:String;
	@:ts.optional
	@:optional var password:String;
	@:ts.optional
	@:optional var protocol:String;
	@:ts.optional
	@:optional var hostname:String;
	@:ts.optional
	@:optional var port:String;
	@:ts.optional
	@:optional var pathname:String;
	@:ts.optional
	@:optional var search:String;
	@:ts.optional
	@:optional var hash:String;
}

typedef URLPatternInput = EitherType<String, URLPatternInit>;

typedef URLPatternComponentResult = {
	final input:String;
	final groups:haxe.DynamicAccess<Undefinable<String>>;
}

/** Successful URLPattern match result. */
@:ts.type("NonNullable<ReturnType<import('next/server').URLPattern['exec']>>")
typedef URLPatternResult = {
	final inputs:Array<URLPatternInput>;
	final protocol:URLPatternComponentResult;
	final username:URLPatternComponentResult;
	final password:URLPatternComponentResult;
	final hostname:URLPatternComponentResult;
	final port:URLPatternComponentResult;
	final pathname:URLPatternComponentResult;
	final search:URLPatternComponentResult;
	final hash:URLPatternComponentResult;
}

/** Direct named-import binding for Next's bundled URLPattern implementation. */
@:jsRequire("next/server", "URLPattern")
extern class URLPattern {
	final protocol:String;
	final username:String;
	final password:String;
	final hostname:String;
	final port:String;
	final pathname:String;
	final search:String;
	final hash:String;

	function new(?init:URLPatternInput, ?baseURL:String):Void;
	function exec(?input:URLPatternInput, ?baseURL:String):Null<URLPatternResult>;
	function test(?input:URLPatternInput, ?baseURL:String):Bool;
}
