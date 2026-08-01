package page_layouts.negative;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("negative/module-user-value-marker")
function render(_:PageProps<NoParams, SearchParams>):Element {
	return <main>module metadata marker</main>;
}

/**
 * Negative control: application code owns the Next convention, not Genes'
 * implementation marker or its native binding name.
 */
@:genes.moduleValue("metadata")
final metadata:Metadata = {
	title: "User-selected compiler marker"
};
