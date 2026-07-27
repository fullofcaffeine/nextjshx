package route_href_fixture.routes;

import genes.ts.Undefinable;
import nextjs.route.RouteHref;
import nextjs.route.RouteHrefWithQuery;
import nextjshx.route.RouteHrefMacro;
import nextjshx.route.RouteQueryMacro;

@:ts.type("\"/about\"")
extern class SparsePattern {}

typedef SparseQuery = {
	final scope:Undefinable<String>;
	@:next.queryName("tag")
	final tags:Array<String>;
}

/** Optional/repeated-only query proof: no emitted pairs preserves the pathname exactly. */
class SparseRoute {
	public static inline function href():RouteHref<SparsePattern> {
		return RouteHrefMacro.build("about");
	}

	public static inline function hrefWithQuery(query:SparseQuery):RouteHrefWithQuery<SparsePattern> {
		return RouteQueryMacro.build("about", query);
	}
}
