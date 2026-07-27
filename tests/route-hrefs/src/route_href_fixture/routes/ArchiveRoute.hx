package route_href_fixture.routes;

import nextjs.route.RouteHref;
import nextjshx.route.RouteHrefMacro;
import route_href_fixture.routes.ArchiveParams;

@:ts.type("\"/archive/\" | `/archive/$${string}`")
extern class ArchivePattern {}

/** Generated-style companion for an absent-or-present optional catch-all. */
class ArchiveRoute {
	public static inline function href(params:ArchiveParams):RouteHref<ArchivePattern> {
		return RouteHrefMacro.build("archive/[[...slug]]", params);
	}
}
