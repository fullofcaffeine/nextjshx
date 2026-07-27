package cache_boundaries_negative;

import genes.js.Async.await;
import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("invalid/raw-cache")
class RawImplementation {
	@:async
	public static function render(_props:PageProps<NoParams, SearchParams>):Promise<Element> {
		final value = await(RawImplementationOwner.read("direct"));
		return <main>{value}</main>;
	}
}
