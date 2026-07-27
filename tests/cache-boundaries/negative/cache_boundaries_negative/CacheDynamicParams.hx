package cache_boundaries_negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("invalid-cache-dynamic-params")
class CacheDynamicParams {
	public static final segment = SegmentConfig.create({dynamicParams: true});

	public static function render(_props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
