package nextjshx.route;

/** The closed P0 App Router segment grammar understood by NextJsHx. */
enum abstract RouteSegmentKind(String) to String {
	var Static = "static";
	var Dynamic = "dynamic";
	var CatchAll = "catch-all";
	var OptionalCatchAll = "optional-catch-all";
}
