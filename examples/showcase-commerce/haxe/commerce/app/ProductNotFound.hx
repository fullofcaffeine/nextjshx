package commerce.app;

import genes.react.Element;
import nextjs.components.NextLink;

/**
 * `@:next.notFound("products")` owns the product segment's conventional
 * `not-found.tsx`. Next's own `notFound()` interruption selects it after the
 * typed catalogue lookup fails.
 */
@:next.notFound("products")
class ProductNotFound {
	public static function render():Element {
		return
			<main className="missing-product"><span>404 / OBJECT NOT FOUND</span><h1>This bed is empty.</h1><p>The requested growing object is not part of this season's catalogue.</p><NextLink href={StorePage.href()}>Return to Common Ground</NextLink></main>;
	}
}
