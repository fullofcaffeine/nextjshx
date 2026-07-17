package nextjshx.route;

/** Describes the value shape Next supplies for one dynamic route segment. */
enum abstract RouteParameterKind(String) to String {
	var Single = "single";
	var CatchAll = "catch-all";
	var OptionalCatchAll = "optional-catch-all";
}
