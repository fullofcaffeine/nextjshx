package server_functions_negative;

import js.lib.Promise;
import nextjs.server.ActionOperation;
import nextjs.server.Authorized;

class WitnessOperation implements ActionOperation {}

@:next.serverFunctions("actions/witness-result")
class WitnessResult {
	@:next.action
	@:async
	public static function expose():Promise<Authorized<WitnessOperation, String, String, String>> {}
}
