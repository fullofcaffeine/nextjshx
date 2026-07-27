package server_functions_negative;

import genes.ts.Unknown;
import js.lib.Promise;

@:next.serverFunctions("actions/unknown-result")
class UnknownResult {
	@:next.action
	@:async
	public static function load():Promise<Unknown> {
		return null;
	}
}
