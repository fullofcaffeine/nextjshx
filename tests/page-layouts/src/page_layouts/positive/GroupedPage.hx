package page_layouts.positive;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.SearchParams;
import page_layouts.positive.DynamicPage.TodoParams;

@:next.page("(marketing)/offers/[id]")
class GroupedPage {
	public static function render(props:PageProps<TodoParams, SearchParams>):Element {
		return <main>GROUPED-PAGE-BUSINESS</main>;
	}
}
