package client_components.server;

import client_components.shared.FlightResourcePayload;
import js.lib.Error;
import js.lib.Promise;
import nextjs.client.flight.v19.FlightPromise;
import nextjs.server.FlightResource;

@:native("Promise")
private extern class ExactPromise<T> extends Promise<T> {
	function new(initialize:((value:T) -> Void, (error:Error) -> Void) -> Void);
}

@:native("setTimeout")
private extern class ServerTimer {
	@:selfCall
	static function schedule(callback:() -> Void, milliseconds:Int):Void;
}

/**
 * Server-owned module resource proving that a Promise is created once, has a
 * closed resolved type, and enters the client graph only through Flight props.
 */
@:next.serverOnly
class FlightResources {
	public static final payload:FlightPromise<FlightResourcePayload> = FlightResource.promise(delayedPayload());

	public static final rejected:FlightPromise<FlightResourcePayload> = FlightResource.promise(rejectedPayload());

	static function delayedPayload():Promise<FlightResourcePayload> {
		return new ExactPromise((resolve, _reject) -> ServerTimer.schedule(() -> resolve({
			message: "Resolved through React use",
			sequence: 19
		}), 1500));
	}

	static function rejectedPayload():Promise<FlightResourcePayload> {
		return new ExactPromise((_resolve, reject) -> ServerTimer.schedule(() -> reject(new Error("reviewed Flight rejection")), 1800));
	}
}
