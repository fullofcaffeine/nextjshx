package clientification.app;

import clientification.client.LeafToggle;
import clientification.shared.FeatureCatalogue;
import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

using nextjs.client.ClientComponent;

@:next.page("leaf")
class LeafPage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final Toggle = LeafToggle.client();
		return <main>
			{FeatureCatalogue.render()}
			<Toggle label="Interactions" />
		</main>;
	}
}
