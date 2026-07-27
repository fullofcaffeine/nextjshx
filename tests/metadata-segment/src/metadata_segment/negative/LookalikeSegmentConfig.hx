package metadata_segment.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/lookalike-config")
class LookalikeSegmentConfig {
	public static final segment = foreign.api.SegmentConfig.create({revalidate: 60});

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
