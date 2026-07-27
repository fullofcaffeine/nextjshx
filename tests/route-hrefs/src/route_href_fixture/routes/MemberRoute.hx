package route_href_fixture.routes;

import nextjs.route.RouteHref;
import nextjshx.route.RouteHrefMacro;

@:ts.type("`/teams/$${string}/members/$${string}`")
extern class MemberPattern {}

@:structInit
class MemberParams {
	public final teamId:String;
	public final memberId:String;

	public inline function new(teamId:String, memberId:String) {
		this.teamId = teamId;
		this.memberId = memberId;
	}
}

/** Generated-style companion proving ordered multi-parameter substitution. */
class MemberRoute {
	public static inline function href(params:MemberParams):RouteHref<MemberPattern> {
		return RouteHrefMacro.build("teams/[teamId]/members/[memberId]", params);
	}
}
