package page_layouts.negative;

import genes.react.Element;
import js.lib.Promise;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

typedef PageLookalike = {
	final params:Promise<NoParams>;
	final searchParams:Promise<SearchParams>;
}

@:next.page("negative/page-props")
class StructuralPageProps {
	public static function render(props:PageLookalike):Element {
		return <main>invalid</main>;
	}
}
