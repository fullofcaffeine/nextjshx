package route_href_fixture;

import nextjs.route.RouteHref;
import route_href_fixture.routes.TodoRoute;
import route_href_fixture.routes.TodoRoute.TodoPattern;

/** Client-side consumer of the same implementation-free route companion. */
@:keep
class ClientConsumer {
	public static function todo(id:String):RouteHref<TodoPattern> {
		return TodoRoute.href({id: id});
	}
}
