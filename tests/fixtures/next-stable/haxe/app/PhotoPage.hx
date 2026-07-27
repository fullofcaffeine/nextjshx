package app;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.components.NextLink;
import nextjs.route.SearchParams;

typedef PhotoParams = {
	final id:String;
}

/** Canonical hard-navigation owner for `/photo/[id]`. */
@:next.page("photo/[id]")
class PhotoPage {
	public static function render(props:PageProps<PhotoParams, SearchParams>):Element {
		return <main id="canonical-photo">
			<p>Canonical Haxe photo route</p>
			<NextLink id="return-feed" href={FeedPage.href()}>Return to the feed</NextLink>
		</main>;
	}
}
