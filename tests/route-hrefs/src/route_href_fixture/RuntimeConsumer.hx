package route_href_fixture;

import genes.ts.Undefinable;
import nextjs.route.RouteHref;
import nextjs.route.RouteHrefWithQuery;
import route_href_fixture.routes.AboutRoute;
import route_href_fixture.routes.AboutRoute.AboutPattern;
import route_href_fixture.routes.ArchiveRoute;
import route_href_fixture.routes.ArchiveRoute.ArchivePattern;
import route_href_fixture.routes.ArchiveParams;
import route_href_fixture.routes.DocsRoute;
import route_href_fixture.routes.DocsRoute.DocsPattern;
import route_href_fixture.routes.MemberRoute;
import route_href_fixture.routes.MemberRoute.MemberPattern;
import route_href_fixture.routes.OrderRoute;
import route_href_fixture.routes.OrderRoute.NumericId;
import route_href_fixture.routes.OrderRoute.OrderPattern;
import route_href_fixture.routes.RootRoute;
import route_href_fixture.routes.RootRoute.RootPattern;
import route_href_fixture.routes.SearchRoute;
import route_href_fixture.routes.SearchRoute.PageNumber;
import route_href_fixture.routes.SearchRoute.SearchPattern;
import route_href_fixture.routes.SearchRoute.SearchScope;
import route_href_fixture.routes.SparseRoute;
import route_href_fixture.routes.SparseRoute.SparsePattern;
import route_href_fixture.routes.TodoRoute;
import route_href_fixture.routes.TodoRoute.TodoPattern;

/** Retains call-site expansions for runtime and Next Route<T> parity evidence. */
@:keep
class RuntimeConsumer {
	public static function root():RouteHref<RootPattern> {
		return RootRoute.href();
	}

	public static function about():RouteHref<AboutPattern> {
		return AboutRoute.href();
	}

	public static function todo(id:String):RouteHref<TodoPattern> {
		return TodoRoute.href({id: id});
	}

	public static function order(id:Int):RouteHref<OrderPattern> {
		return OrderRoute.href({id: new NumericId(id)});
	}

	public static function member(teamId:String, memberId:String):RouteHref<MemberPattern> {
		return MemberRoute.href({teamId: teamId, memberId: memberId});
	}

	public static function docs(slug:Array<String>):RouteHref<DocsPattern> {
		return DocsRoute.href({slug: slug});
	}

	public static function archiveAbsent():RouteHref<ArchivePattern> {
		final slug:Undefinable<Array<String>> = Undefinable.absent();
		final params:ArchiveParams = {slug: slug};
		return ArchiveRoute.href(params);
	}

	public static function archive(slug:Array<String>):RouteHref<ArchivePattern> {
		final params:ArchiveParams = {slug: slug};
		return ArchiveRoute.href(params);
	}

	public static function search(term:String, page:Int, exact:Bool, scope:String, tags:Array<String>):RouteHrefWithQuery<SearchPattern> {
		final typedScope:SearchScope = scope;
		final optionalScope:Undefinable<SearchScope> = typedScope;
		return SearchRoute.hrefWithQuery({section: "products"}, {
			term: term,
			page: new PageNumber(page),
			exact: exact,
			scope: optionalScope,
			tags: tags
		});
	}

	public static function searchWithoutOptional(term:String):RouteHrefWithQuery<SearchPattern> {
		final scope:Undefinable<SearchScope> = Undefinable.absent();
		return SearchRoute.hrefWithQuery({section: "all items"}, {
			term: term,
			page: new PageNumber(1),
			exact: false,
			scope: scope,
			tags: []
		});
	}

	public static function sparse():RouteHrefWithQuery<SparsePattern> {
		final scope:Undefinable<String> = Undefinable.absent();
		return SparseRoute.hrefWithQuery({scope: scope, tags: []});
	}
}
