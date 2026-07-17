package nextjshx.route;

import haxe.ds.ReadOnlyArray;

/** The exact typed parameter bindings for one validated route declaration. */
@:structInit
class RouteParameterValidation {
	public final bindings:ReadOnlyArray<RouteParameterBinding>;

	public function new(bindings:Array<RouteParameterBinding>) {
		this.bindings = bindings.copy();
	}
}
