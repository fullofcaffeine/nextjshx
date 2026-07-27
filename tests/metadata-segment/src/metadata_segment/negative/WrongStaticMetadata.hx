package metadata_segment.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/static-type")
class WrongStaticMetadata {
	public static final metadata:String = "not Next metadata";

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
