package page_layouts.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/module-metadata")
function render(_:PageProps<NoParams, SearchParams>):Element {
	return <main>module metadata</main>;
}

final metadata:Metadata = {
	title: "Unsupported direct module value"
};
