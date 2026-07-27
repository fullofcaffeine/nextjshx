package page_layouts.positive;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("")
class RootPage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>ROOT-PAGE-BUSINESS</main>;
	}
}
