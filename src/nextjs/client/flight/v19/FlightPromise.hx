package nextjs.client.flight.v19;

/**
 * React 19 Flight Promise created once by a reviewed server-only module.
 *
 * The abstract erases to the exact native `Promise<T>` representation. It has
 * no implicit conversion from an ordinary Promise: construction goes through
 * `nextjs.server.FlightResource.promise(...)`, whose macro rejects
 * render/function-local creation and validates the resolved Flight value.
 */
abstract FlightPromise<T>(js.lib.Promise<T>) {
	@:allow(nextjshx.boundary.FlightPromiseMacro)
	private inline function new(value:js.lib.Promise<T>) {
		this = value;
	}
}
