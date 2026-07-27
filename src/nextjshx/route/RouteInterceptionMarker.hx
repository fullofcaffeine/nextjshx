package nextjshx.route;

/** The four filesystem-relative interception markers supported by Next. */
enum abstract RouteInterceptionMarker(String) to String {
	var SameLevel = "(.)";
	var Parent = "(..)";
	var Grandparent = "(..)(..)";
	var Root = "(...)";
}
