package page_layouts.positive;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("@analytics")
class ParallelPage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <aside>PARALLEL-PAGE-BUSINESS</aside>;
	}
}
