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
 * NextJsHx checks this value against Next's public Metadata type, then asks
 * Genes to emit a normal JavaScript `export const`. Next still controls how the
 * metadata affects the rendered page.
 */
final metadata:Metadata = {
	title: "Direct module metadata"
};
