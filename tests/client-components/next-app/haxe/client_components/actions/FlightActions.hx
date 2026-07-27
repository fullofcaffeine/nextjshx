package client_components.actions;

/** Server Function used as a provenance-bearing Client Component prop. */
@:next.serverFunctions("_nextjshx/actions/flight")
class FlightActions {
	@:next.action
	@:async
	public static function ping(label:String):js.lib.Promise<String> {
		return js.lib.Promise.resolve('Server Function received $label');
	}
}
