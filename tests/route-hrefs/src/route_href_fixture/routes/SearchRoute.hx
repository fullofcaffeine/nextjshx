package route_href_fixture.routes;

import genes.ts.Undefinable;
import nextjs.route.RouteHref;
import nextjs.route.RouteHrefWithQuery;
import nextjshx.route.RouteHrefMacro;
import nextjshx.route.RouteQueryMacro;

@:ts.type("`/search/$${string}`")
extern class SearchPattern {}

@:next.queryCodec(route_href_fixture.routes.SearchRoute.PageNumberCodec)
abstract PageNumber(Int) from Int to Int {
	public inline function new(value:Int) {
		this = value;
	}
}

class PageNumberCodec {
	public static function encode(value:PageNumber):String {
		return Std.string(value);
	}
}

enum abstract SearchScope(String) from String to String {
	final All = "all";
	final Open = "open";
}

@:structInit
class SearchParams {
	public final section:String;

	public inline function new(section:String) {
		this.section = section;
	}
}

@:structInit
class SearchQuery {
	@:next.queryName("q")
	public final term:String;
	public final page:PageNumber;
	public final exact:Bool;
	public final scope:Undefinable<SearchScope>;
	@:next.queryName("tag")
	public final tags:Array<String>;

	public inline function new(term:String, page:PageNumber, exact:Bool, scope:Undefinable<SearchScope>, tags:Array<String>) {
		this.term = term;
		this.page = page;
		this.exact = exact;
		this.scope = scope;
		this.tags = tags;
	}
}

/** Generated-style companion proving scalar, optional, repeated, and domain query values. */
class SearchRoute {
	public static inline function href(params:SearchParams):RouteHref<SearchPattern> {
		return RouteHrefMacro.build("search/[section]", params);
	}

	public static inline function hrefWithQuery(params:SearchParams, query:SearchQuery):RouteHrefWithQuery<SearchPattern> {
		return RouteQueryMacro.build("search/[section]", params, query);
	}
}
