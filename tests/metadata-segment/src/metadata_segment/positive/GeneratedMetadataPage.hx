package metadata_segment.positive;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageMetadataProps;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.raw.metadata.Metadata;
import nextjs.raw.metadata.ResolvingMetadata;
import nextjs.route.SearchParams;

typedef ProductParams = {
	final slug:String;
}

@:next.page("proof/products/[slug]")
class GeneratedMetadataPage {
	public static final segment = SegmentConfig.create({
		preferredRegion: ["iad1", "sfo1"],
		dynamicParams: false,
		revalidate: 60,
		maxDuration: 10
	});

	public static function generateMetadata(props:PageMetadataProps<ProductParams, SearchParams>, parent:ResolvingMetadata):Promise<Metadata> {
		final value:Metadata = {
			title: "Generated product metadata"
		};
		return Promise.resolve(value);
	}

	public static function generateStaticParams():Promise<Array<ProductParams>> {
		return Promise.resolve([{slug: "first"}, {slug: "second"}]);
	}

	public static function render(props:PageProps<ProductParams, SearchParams>):Element {
		return <main>GENERATED-METADATA-BUSINESS</main>;
	}
}
