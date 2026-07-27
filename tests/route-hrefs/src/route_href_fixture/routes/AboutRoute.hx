package route_href_fixture.routes;

import nextjs.route.RouteHref;
import nextjshx.route.RouteHrefMacro;

@:ts.type("\"/about\"")
extern class AboutPattern {}

/** Generated-style companion for a static route. */
class AboutRoute {
	public static inline function href():RouteHref<AboutPattern> {
		return RouteHrefMacro.build("about");
	}
}
