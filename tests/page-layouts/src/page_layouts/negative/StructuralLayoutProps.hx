package page_layouts.negative;

import genes.react.Element;
import js.lib.Promise;
import nextjs.raw.react.ReactNode;
import nextjs.route.NoParams;

typedef LayoutLookalike = {
	final children:ReactNode;
	final params:Promise<NoParams>;
}

@:next.layout("negative/layout-props")
class StructuralLayoutProps {
	public static function render(props:LayoutLookalike):Element {
		return <section>{props.children}</section>;
	}
}
