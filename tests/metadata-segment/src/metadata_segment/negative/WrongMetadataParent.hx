package metadata_segment.negative;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.MetadataProps;
import nextjs.app.PageProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/parent")
class WrongMetadataParent {
	public static function generateMetadata(props:MetadataProps<NoParams>, parent:Promise<Metadata>):Metadata {
		return {title: "invalid"};
	}

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
