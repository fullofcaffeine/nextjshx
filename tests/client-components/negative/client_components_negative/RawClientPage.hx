package client_components_negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("raw-client")
class RawClientPage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return RawClient.render({label: "unsafe"});
	}
}
