package page_layouts.negative;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

/** Proves that adapter module requests cannot depend on runtime values. */
@:next.layout("negative/css-nonliteral")
@:next.css(NonliteralCss.path)
class NonliteralCss {
	private static final path = "./styles.css";

	public static function render(props:LayoutProps<NoParams>):Element {
		return <section>{props.children}</section>;
	}
}
