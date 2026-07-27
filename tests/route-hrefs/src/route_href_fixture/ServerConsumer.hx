package route_href_fixture;

import nextjs.route.RouteHref;
import route_href_fixture.routes.TodoRoute;
import route_href_fixture.routes.TodoRoute.TodoPattern;

/** Server-side consumer of the same implementation-free route companion. */
@:keep
class ServerConsumer {
	public static function todo(id:String):RouteHref<TodoPattern> {
		return TodoRoute.href({id: id});
	}
}
