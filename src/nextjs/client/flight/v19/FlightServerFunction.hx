package nextjs.client.flight.v19;

import haxe.Constraints.Function;

/**
 * Callable React 19 Flight reference whose provenance was validated by
 * `ServerFunction.ref`.
 *
 * The abstract erases to its exact function signature. It has no public
 * constructor or conversion from an ordinary callback, so function shape
 * alone cannot manufacture a Server Function capability.
 */
@:callable
abstract FlightServerFunction<F:Function>(F) to F {
	@:allow(nextjshx.server.ServerFunctionMacro)
	private inline function new(value:F) {
		this = value;
	}

	/**
	 * Exposes the exact callable for host declarations that spell a function
	 * inside another structural union. The capability itself remains
	 * unforgeable; this method only removes the nominal view after validation.
	 */
	public inline function callable():F {
		return this;
	}
}
