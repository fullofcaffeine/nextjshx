package route_href_fixture.routes;

import nextjs.route.RouteHref;
import nextjshx.route.RouteHrefMacro;

@:ts.type("\"/\"")
extern class RootPattern {}

/** Generated-style companion for the App Router root. */
class RootRoute {
	public static inline function href():RouteHref<RootPattern> {
		return RouteHrefMacro.build("");
	}
}
