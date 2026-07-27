package metadata_segment.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/runtime-config")
class RuntimeConfigExpression {
	static function seconds():Int {
		return 30;
	}

	public static final segment = SegmentConfig.create({revalidate: seconds()});

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
