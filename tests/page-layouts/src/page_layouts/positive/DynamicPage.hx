package page_layouts.positive;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.route.SearchParams;

typedef TodoParams = {
	final id:String;
}

@:next.page("todos/[id]")
@:next.query(page_layouts.positive.TodoQuery)
class DynamicPage {
	public static function render(props:PageProps<TodoParams, SearchParams>):Promise<Element> {
		return Promise.resolve(<article>DYNAMIC-PAGE-BUSINESS</article>);
	}
}
