package server_functions_negative;

import js.lib.Promise;

@:next.serverFunctions("actions/sync")
class SyncAction {
	@:next.action
	public static function save(value:String):Promise<String> {
		return Promise.resolve(value);
	}
}
