package app;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.components.NextLink;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

/** Canonical feed retained behind an intercepted photo during soft navigation. */
@:next.page("feed")
class FeedPage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main id="feed-page">
			<h2>Typed photo feed</h2>
			<NextLink id="open-photo" href={PhotoPage.href({id: "42"})}>Open photo 42</NextLink>
		</main>;
	}
}
