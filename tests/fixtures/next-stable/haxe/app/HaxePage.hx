package app;

import genes.react.Element;
import genes.ts.Undefinable;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.app.SegmentRuntime;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

/** Haxe-owned `/haxe` page reached through a generated Next-native adapter. */
@:next.page("haxe")
class HaxePage {
	public static final metadata:Metadata = {
		title: "Static metadata from Haxe",
		description: "A typed Haxe field becomes a native Next.js metadata export."
	};

	public static final segment = SegmentConfig.create({
		runtime: SegmentRuntime.NodeJs,
		preferredRegion: "home",
		revalidate: false,
		maxDuration: 5
	});

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final preview:Undefinable<Bool> = Undefinable.absent();
		final productHref = ProductPage.hrefWithQuery({slug: "first"}, {
			page: 2,
			preview: preview,
			tags: ["haxe next", "typed"]
		});
		return <main id={"haxe-page"}>
      <p>This page implementation originated in typed Haxe.</p>
      <a id={"typed-query-link"} href={productHref}>Typed product query</a>
    </main>;
	}
}
