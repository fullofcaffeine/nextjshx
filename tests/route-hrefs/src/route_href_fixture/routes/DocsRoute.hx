package route_href_fixture.routes;

import nextjs.route.RouteHref;
import nextjshx.route.RouteHrefMacro;

@:ts.type("`/docs/$${string}`")
extern class DocsPattern {}

@:structInit
class DocsParams {
	public final slug:Array<String>;

	public inline function new(slug:Array<String>) {
		this.slug = slug;
	}
}

/** Generated-style companion encoding each catch-all segment independently. */
class DocsRoute {
	public static inline function href(params:DocsParams):RouteHref<DocsPattern> {
		return RouteHrefMacro.build("docs/[...slug]", params);
	}
}
