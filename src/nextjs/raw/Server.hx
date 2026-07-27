package nextjs.raw;

import genes.ts.Undefinable;
import js.lib.Promise;
import nextjs.raw.server.UserAgent;

typedef UserAgentRequest = {
	final headers:js.html.Headers;
}

/** Direct public bindings for the documented `next/server` helpers. */
extern class Server {
	@:overload(function<T>(task:Void->T):Void {})
	@:overload(function<T>(task:Void->Promise<T>):Void {})
	@:jsRequire("next/server", "after")
	static function after<T>(task:Promise<T>):Void;

	@:jsRequire("next/server", "connection")
	static function connection():Promise<Void>;

	@:jsRequire("next/server", "userAgent")
	static function userAgent(request:UserAgentRequest):UserAgent;

	@:jsRequire("next/server", "userAgentFromString")
	static function userAgentFromString(input:Undefinable<String>):UserAgent;
}
