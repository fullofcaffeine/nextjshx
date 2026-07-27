package metadata_segment.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/static-route")
class StaticRouteParams {
	public static function generateStaticParams():Array<NoParams> {
		return [{}];
	}

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
