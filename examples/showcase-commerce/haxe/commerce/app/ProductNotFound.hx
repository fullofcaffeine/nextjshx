package commerce.app;

import genes.react.Element;
import nextjs.components.NextLink;

/** Product-segment 404 reached through the typed Haxe not-found flow. */
@:next.notFound("products")
class ProductNotFound {
	public static function render():Element {
		return
			<main className="missing-product"><span>404 / OBJECT NOT FOUND</span><h1>This bed is empty.</h1><p>The requested growing object is not part of this season's catalogue.</p><NextLink href={StorePage.href()}>Return to Common Ground</NextLink></main>;
	}
}
