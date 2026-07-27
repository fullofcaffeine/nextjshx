package nextjs.raw.server;

import js.lib.Promise;

/** Request-lifetime event supplied to Next proxy and legacy middleware calls. */
@:jsRequire("next/server", "NextFetchEvent")
extern class NextFetchEvent {
	final sourcePage:String;
	function passThroughOnException():Void;
	function waitUntil<T>(promise:Promise<T>):Void;
}
