package metadata_segment.positive;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.app.SegmentRuntime;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("proof/static-metadata")
class StaticMetadataPage {
	public static final metadata:Metadata = {
		title: "Static metadata from Haxe",
		description: "A typed Haxe field becomes Next's native metadata export."
	};

	public static final segment = SegmentConfig.create({
		runtime: SegmentRuntime.NodeJs,
		preferredRegion: "home",
		revalidate: false,
		maxDuration: 5
	});

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>STATIC-METADATA-BUSINESS</main>;
	}
}
