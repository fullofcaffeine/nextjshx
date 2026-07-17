package nextjshx.route;

/** The total result of parsing a route path without throwing or writing files. */
enum RoutePatternParseResult {
	Parsed(pattern:RoutePattern);
	Rejected(diagnostic:RouteParseDiagnostic);
}
