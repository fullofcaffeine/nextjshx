package page_layouts.negative;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

/** Proves that one stylesheet cannot occupy two ambiguous cascade positions. */
@:next.layout("negative/css-duplicate")
@:next.css("design-system/theme.css")
@:next.css("design-system/theme.css")
class DuplicateCss {
	public static function render(props:LayoutProps<NoParams>):Element {
		return <section>{props.children}</section>;
	}
}
