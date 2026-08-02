package page_layouts.positive;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.route.SearchParams;

typedef ModuleProductParams = {
	final id:String;
}

/**
 * Owns one dynamic App Router page without introducing an all-static class.
 *
 * `@:next.page` marks the module's canonical `render` function as the page
 * owner. NextJsHx checks the same props, route, and static-params contracts as
 * the compatibility class form, then imports these ordinary
 * module bindings into the generated `page.tsx` adapter.
 */
@:next.page("module-products/[id]")
function render(props:PageProps<ModuleProductParams, SearchParams>):Promise<Element> {
	return props.params.then(params -> <article>MODULE-PRODUCT-{params.id}</article>);
}

/** Enumerates the build-time params consumed by Next's native route contract. */
function generateStaticParams():Array<ModuleProductParams> {
	return [{id: "featured"}];
}
