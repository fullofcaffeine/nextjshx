package page_layouts.positive;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.SearchParams;
import page_layouts.positive.DynamicPage.TodoParams;

@:next.page("feed/@modal/(..)photo/[id]")
class InterceptedPage {
	public static function render(props:PageProps<TodoParams, SearchParams>):Element {
		return <dialog>INTERCEPTED-PAGE-BUSINESS</dialog>;
	}
}
