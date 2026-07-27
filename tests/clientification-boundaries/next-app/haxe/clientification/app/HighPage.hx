package clientification.app;

import clientification.client.HighDashboard;
import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

using nextjs.client.ClientComponent;

@:next.page("high")
class HighPage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final Dashboard = HighDashboard.client();
		return <Dashboard label="Interactions" />;
	}
}
