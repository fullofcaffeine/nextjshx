package server_functions_negative;

import js.lib.Promise;

private class ActionSession {
	public function new() {}
}

@:next.serverFunctions("actions/class-argument")
class ClassArgument {
	@:next.action
	@:async
	public static function save(session:ActionSession):Promise<Void> {}
}
