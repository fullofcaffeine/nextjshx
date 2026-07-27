package nextjshx.route;

/** How one App Router declaration participates in public route ownership. */
enum abstract RouteTopologyKind(String) to String {
	/** A page or Route Handler that owns its canonical public URL. */
	var Canonical = "canonical";

	/** A page rendered through one or more `@slot` layout properties. */
	var ParallelView = "parallel-view";

	/** A soft-navigation view whose hard-navigation URL belongs to another route. */
	var InterceptedView = "intercepted-view";
}
