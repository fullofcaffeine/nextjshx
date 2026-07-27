package server_functions_negative;

import js.lib.Promise;

@:next.serverFunctions("actions/optional")
class OptionalArgument {
	@:next.action
	@:async
	public static function save(?value:String):Promise<Void> {}
}
