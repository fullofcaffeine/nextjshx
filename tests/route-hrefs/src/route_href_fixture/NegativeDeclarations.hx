package route_href_fixture;

import route_href_fixture.routes.AboutRoute;
import route_href_fixture.routes.TodoRoute;

/** Compile-fail declarations for exact href param diagnostics. */
class NegativeDeclarations {
	public static function main():Void {
		#if href_missing
		TodoRoute.href({slug: "wrong"});
		#elseif href_extra
		TodoRoute.href({id: "one", extra: "wrong"});
		#elseif href_wrong_type
		TodoRoute.href({id: 42});
		#elseif href_dynamic_without_params
		TodoRoute.href();
		#elseif href_static_with_params
		AboutRoute.href({id: "wrong"});
		#elseif href_unchecked_string
		final forged:nextjs.route.RouteHref<route_href_fixture.routes.TodoRoute.TodoPattern> = "/todos/unchecked";
		trace(forged);
		#elseif query_missing
		final scope:genes.ts.Undefinable<route_href_fixture.routes.SearchRoute.SearchScope> = genes.ts.Undefinable.absent();
		route_href_fixture.routes.SearchRoute.hrefWithQuery({section: "all"}, {
			term: "haxe",
			page: new route_href_fixture.routes.SearchRoute.PageNumber(1),
			exact: true,
			scope: scope
		});
		#elseif query_extra
		final scope:genes.ts.Undefinable<route_href_fixture.routes.SearchRoute.SearchScope> = genes.ts.Undefinable.absent();
		route_href_fixture.routes.SearchRoute.hrefWithQuery({section: "all"}, {
			term: "haxe",
			page: new route_href_fixture.routes.SearchRoute.PageNumber(1),
			exact: true,
			scope: scope,
			tags: [],
			forged: "x"
		});
		#elseif query_wrong_type
		final scope:genes.ts.Undefinable<route_href_fixture.routes.SearchRoute.SearchScope> = genes.ts.Undefinable.absent();
		route_href_fixture.routes.SearchRoute.hrefWithQuery({section: "all"}, {
			term: "haxe",
			page: "one",
			exact: true,
			scope: scope,
			tags: []
		});
		#elseif query_unsupported
		nextjshx.route.RouteQueryMacro.build("about", new UnsupportedQuery(0.5));
		#elseif query_bad_codec
		nextjshx.route.RouteQueryMacro.build("about", new BadCodecQuery(1));
		#elseif query_forged_string
		nextjshx.route.RouteQueryMacro.build("about", "page=1&scope=admin");
		#elseif query_mutable
		nextjshx.route.RouteQueryMacro.build("about", new MutableQuery("unsafe"));
		#elseif query_path_arity
		nextjshx.route.RouteQueryMacro.build("todos/[id]", new ValidQuery("safe"));
		#end
	}
}

@:structInit
class UnsupportedQuery {
	public final ratio:Float;

	public inline function new(ratio:Float) {
		this.ratio = ratio;
	}
}

@:next.queryCodec(route_href_fixture.NegativeDeclarations.BadTokenCodec)
abstract BadToken(Int) from Int to Int {}

class BadTokenCodec {
	public static function encode(value:String):String {
		return value;
	}
}

@:structInit
class BadCodecQuery {
	public final token:BadToken;

	public inline function new(token:BadToken) {
		this.token = token;
	}
}

@:structInit
class MutableQuery {
	public var value:String;

	public inline function new(value:String) {
		this.value = value;
	}
}

@:structInit
class ValidQuery {
	public final value:String;

	public inline function new(value:String) {
		this.value = value;
	}
}
