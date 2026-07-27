package page_layouts.negative;

import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

@:next.layout("negative/return")
class WrongReturn {
	public static function render(props:LayoutProps<NoParams>):String {
		return "invalid";
	}
}
