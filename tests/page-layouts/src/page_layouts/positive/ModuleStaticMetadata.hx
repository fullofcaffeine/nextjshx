package page_layouts.positive;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("module-metadata")
function render(_:PageProps<NoParams, SearchParams>):Element {
	return <main>module metadata</main>;
}

/**
 * Becomes Next's ordinary `export const metadata` without a static shell class.
 *
 * NextJsHx validates the exact public Metadata type and derives Genes' generic
 * direct-module-value marker. The marker changes only emitted ESM shape; Next
 * remains the metadata type/runtime oracle.
 */
final metadata:Metadata = {
	title: "Direct module metadata"
};
