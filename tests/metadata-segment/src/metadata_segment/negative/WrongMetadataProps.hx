package metadata_segment.negative;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.SearchParams;

typedef MetadataParams = {
	final id:String;
}

typedef MetadataPropsLookalike = {
	final params:Promise<MetadataParams>;
}

@:next.page("negative/metadata/[id]")
class WrongMetadataProps {
	public static function generateMetadata(props:MetadataPropsLookalike):Metadata {
		return {title: "invalid"};
	}

	public static function render(props:PageProps<MetadataParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
