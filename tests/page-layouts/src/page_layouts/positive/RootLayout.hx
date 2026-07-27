package page_layouts.positive;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.react.ReactNode;
import nextjs.route.NoParams;

/** Root layout slots mirror the immediate `app/@analytics` directory. */
@:next.layoutSlots
typedef RootLayoutProps = {
	> LayoutProps<NoParams>,
	final analytics:ReactNode;
}

@:next.layout("")
class RootLayout {
	public static function render(props:RootLayoutProps):Element {
		return <html><body>{props.children}<aside>{props.analytics}</aside></body></html>;
	}
}
