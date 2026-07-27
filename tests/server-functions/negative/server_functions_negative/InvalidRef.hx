package server_functions_negative;

import js.lib.Promise;
import nextjs.server.ServerFunction;

class OrdinaryActions {
	@:async
	public static function save(value:String):Promise<String> {
		return value;
	}
}

class InvalidRef {
	public static function consume():Void {
		final save = ServerFunction.ref(OrdinaryActions.save);
	}
}
