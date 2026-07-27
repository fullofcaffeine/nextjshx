package nextjs.raw.server;

import genes.ts.Undefinable;

/** Public Next URL view available from `NextRequest.nextUrl`. */
@:ts.type("import('next/server').NextRequest['nextUrl']")
extern class NextUrl {
	var basePath:String;
	var buildId:Undefinable<String>;
	final defaultLocale:Undefinable<String>;
	var hash:String;
	var host:String;
	var hostname:String;
	var href:String;
	var locale:String;
	final origin:String;
	var password:String;
	var pathname:String;
	var port:String;
	var protocol:String;
	var search:String;
	final searchParams:WebSearchParams;
	var username:String;

	function clone():NextUrl;
	function toJSON():String;
	function toString():String;
}
