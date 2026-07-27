package route_href_fixture.routes;

import nextjs.route.RouteHref;
import nextjshx.route.RouteHrefMacro;

@:ts.type("`/todos/$${string}`")
extern class TodoPattern {}

abstract TodoId(String) from String to String {}

@:structInit
class TodoParams {
	public final id:TodoId;

	public inline function new(id:TodoId) {
		this.id = id;
	}
}

/** Generated-style companion for one string-backed dynamic segment. */
class TodoRoute {
	public static inline function href(params:TodoParams):RouteHref<TodoPattern> {
		return RouteHrefMacro.build("todos/[id]", params);
	}
}
