package server_functions_negative.raw;

import js.lib.Promise;

@:next.serverFunctions("actions/raw")
class RawActions {
	@:next.action
	@:async
	public static function save(value:String):Promise<String> {
		return value;
	}
}
