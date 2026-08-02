package page_layouts.negative;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

/** Proves that a missing co-located stylesheet fails before adapter output. */
@:next.layout("negative/css-missing")
@:next.css("./missing.css")
class MissingCss {
	public static function render(props:LayoutProps<NoParams>):Element {
		return <section>{props.children}</section>;
	}
}
