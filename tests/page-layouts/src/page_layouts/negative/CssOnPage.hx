package page_layouts.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

/** Proves that page files cannot become competing owners of global CSS. */
@:next.page("negative/css-page")
@:next.css("./styles.css")
class CssOnPage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>Page</main>;
	}
}
