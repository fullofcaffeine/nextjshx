package metadata_segment.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/unknown-config")
class UnknownConfig {
	public static final segment = SegmentConfig.create({experimentalOption: true});

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
