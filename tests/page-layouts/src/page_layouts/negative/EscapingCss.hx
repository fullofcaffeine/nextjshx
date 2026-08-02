package page_layouts.negative;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

/** Proves that relative CSS imports stay beside their generated layout. */
@:next.layout("negative/css-escape")
@:next.css("../globals.css")
class EscapingCss {
	public static function render(props:LayoutProps<NoParams>):Element {
		return <section>{props.children}</section>;
	}
}
