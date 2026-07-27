package page_layouts.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;

typedef TrustedQuery = {
	final page:Int;
}

@:next.page("negative/query")
class WrongQuery {
	public static function render(props:PageProps<NoParams, TrustedQuery>):Element {
		return <main>invalid</main>;
	}
}
