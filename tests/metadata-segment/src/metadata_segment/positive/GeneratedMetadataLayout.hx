package metadata_segment.positive;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.app.MetadataProps;
import nextjs.app.SegmentConfig;
import nextjs.app.SegmentRuntime;
import nextjs.raw.metadata.Metadata;
import nextjs.raw.metadata.ResolvingMetadata;

typedef CatalogParams = {
	final category:String;
}

@:next.layout("proof/catalog/[category]")
class GeneratedMetadataLayout {
	public static final segment = SegmentConfig.create({
		runtime: SegmentRuntime.Edge,
		preferredRegion: "global",
		dynamicParams: true
	});

	public static function generateMetadata(props:MetadataProps<CatalogParams>, parent:ResolvingMetadata):Metadata {
		return {
			title: "Generated catalog layout metadata"
		};
	}

	public static function generateStaticParams():Array<CatalogParams> {
		return [{category: "featured"}];
	}

	public static function render(props:LayoutProps<CatalogParams>):Element {
		return <section>{props.children}</section>;
	}
}
