package nextjshx.route;

/** The closed App Router filesystem segment grammar understood by NextJsHx. */
enum abstract RouteSegmentKind(String) to String {
	var Static = "static";
	var Dynamic = "dynamic";
	var CatchAll = "catch-all";
	var OptionalCatchAll = "optional-catch-all";
	var Group = "group";
	var ParallelSlot = "parallel-slot";
}
