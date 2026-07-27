package cache_boundaries_negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("invalid-sync-page")
@:next.cache
class SyncPage {
	public static function render(_props:PageProps<NoParams, SearchParams>):Element {
		return <main>sync</main>;
	}
}
