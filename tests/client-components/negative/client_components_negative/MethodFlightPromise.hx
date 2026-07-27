package client_components_negative;

import nextjs.server.FlightResource;

@:next.serverOnly
class MethodFlightPromise {
	public static function create():Void {
		FlightResource.promise(js.lib.Promise.resolve("unstable"));
	}
}
