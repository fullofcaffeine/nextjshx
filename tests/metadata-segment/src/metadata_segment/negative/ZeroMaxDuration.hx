package metadata_segment.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/max-duration")
class ZeroMaxDuration {
	public static final segment = SegmentConfig.create({maxDuration: 0});

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
