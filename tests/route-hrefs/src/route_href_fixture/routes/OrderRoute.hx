package route_href_fixture.routes;

import nextjs.route.RouteHref;
import nextjshx.route.RouteHrefMacro;

@:ts.type("`/orders/$${string}`")
extern class OrderPattern {}

@:next.routeCodec(route_href_fixture.routes.OrderRoute.NumericIdCodec)
abstract NumericId(Int) from Int to Int {
	public inline function new(value:Int) {
		this = value;
	}
}

class NumericIdCodec {
	public static function decode(value:String):NumericId {
		final parsed = Std.parseInt(value);
		return new NumericId(parsed == null ? 0 : parsed);
	}

	public static function encode(value:NumericId):String {
		return Std.string(value);
	}
}

@:structInit
class OrderParams {
	public final id:NumericId;

	public inline function new(id:NumericId) {
		this.id = id;
	}
}

/** Generated-style companion proving codecs run before URL encoding. */
class OrderRoute {
	public static inline function href(params:OrderParams):RouteHref<OrderPattern> {
		return RouteHrefMacro.build("orders/[id]", params);
	}
}
