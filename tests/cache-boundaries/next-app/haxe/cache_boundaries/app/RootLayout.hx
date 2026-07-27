package cache_boundaries.app;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

@:next.layout("")
class RootLayout {
	public static function render(props:LayoutProps<NoParams>):Element {
		return <html lang={"en"}><body>{props.children}</body></html>;
	}
}
