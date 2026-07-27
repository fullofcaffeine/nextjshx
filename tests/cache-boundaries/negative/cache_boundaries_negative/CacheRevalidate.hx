package cache_boundaries_negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("invalid-cache-revalidate")
class CacheRevalidate {
	public static final segment = SegmentConfig.create({revalidate: 60});

	public static function render(_props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
