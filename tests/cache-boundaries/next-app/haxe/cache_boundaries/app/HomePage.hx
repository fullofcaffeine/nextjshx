package cache_boundaries.app;

import cache_boundaries.cache.CachedCounter;
import genes.js.Async.await;
import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.cache.CacheFunction;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

/** A normal server page consumes the generated cached-function boundary. */
@:next.page("")
class HomePage {
	@:async
	public static function render(_props:PageProps<NoParams, SearchParams>):Promise<Element> {
		final read = CacheFunction.ref(CachedCounter.read);
		final sample = await(read("page"));
		return <main><h1>Native Cache Components</h1><p id={"page-cache-value"}>{'page:${sample.invocation}'}</p></main>;
	}
}
