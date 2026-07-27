package page_layouts.positive;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.LayoutProps;
import page_layouts.positive.DynamicPage.TodoParams;

@:next.layout("todos/[id]")
class NestedLayout {
	public static function render(props:LayoutProps<TodoParams>):Promise<Element> {
		return Promise.resolve(<section>{props.children}</section>);
	}
}
