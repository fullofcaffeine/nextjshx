package metadata_segment.negative;

import genes.react.Element;
import nextjs.app.MetadataProps;
import nextjs.app.PageProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/conflict")
class ConflictingMetadata {
	public static final metadata:Metadata = {title: "static"};

	public static function generateMetadata(props:MetadataProps<NoParams>):Metadata {
		return {title: "generated"};
	}

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		return <main>invalid</main>;
	}
}
