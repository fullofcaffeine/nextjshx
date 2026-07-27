package client_components_negative;

import nextjs.client.flight.v19.FlightServerFunction;

/** Function shape alone cannot forge generated Server Function provenance. */
class ForgedServerFunction {
	static function ordinary(label:String):js.lib.Promise<String> {
		return js.lib.Promise.resolve(label);
	}

	public static function prove():Void {
		final forged:FlightServerFunction<String->js.lib.Promise<String>> = ordinary;
	}
}
