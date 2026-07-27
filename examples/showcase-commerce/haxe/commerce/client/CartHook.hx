package commerce.client;

import commerce.domain.Product.ProductSlug;
import nextjs.client.React;

enum abstract CatalogFilter(String) to String {
	final All = "all";
	final Systems = "systems";
	final Tools = "tools";
}

enum abstract CartProductCategory(String) to String {
	final Systems = "systems";
	final Tools = "tools";
}

typedef CartProduct = {
	final slug:ProductSlug;
	final name:String;
	final edition:String;
	final category:CartProductCategory;
	final price:String;
	final priceCents:Int;
	final image:String;
	final alt:String;
	final tagline:String;
}

typedef CartLine = {
	final product:CartProduct;
	final quantity:Int;
}

typedef CartModel = {
	final filter:CatalogFilter;
	final lines:Array<CartLine>;
	final count:Int;
	final totalCents:Int;
	final showAll:Void->Void;
	final showSystems:Void->Void;
	final showTools:Void->Void;
	final add:ProductSlug->Void;
	final remove:ProductSlug->Void;
	final clear:Void->Void;
}

private typedef CartQuantity = {
	final slug:ProductSlug;
	final quantity:Int;
}

/**
 * Haxe-authored cart Hook using the semantic React state surface.
 *
 * Quantities use a closed immutable array rather than an open JavaScript
 * dictionary. That keeps slug and quantity operations Haxe-checked while the
 * small showcase catalogue makes the linear lookup cost immaterial.
 */
class CartHook {
	/**
	 * `@:next.hook` enables Haxe-side React Hook placement checks.
	 * `@:next.exportHook` also publishes an ordinary directive-first
	 * `useShopCart` TypeScript const alias, preserving types and identity
	 * without a delegating wrapper.
	 */
	@:next.hook
	@:next.exportHook
	public static function useShopCart(products:Array<CartProduct>):CartModel {
		// Semantic state names intent: `.set(value)` replaces while
		// `.update(previous -> next)` performs a functional update.
		final filter = React.useState(CatalogFilter.All);
		final quantities = React.useState(new Array<CartQuantity>());
		// `React.deps(...)` is compile-time packaging. It emits the direct,
		// lint-visible dependency array rather than a runtime helper call.
		final lines = React.useMemo((products, currentQuantities) -> buildLines(products, currentQuantities), React.deps(products, quantities.value));
		var count = 0;
		var totalCents = 0;
		for (line in lines) {
			count += line.quantity;
			totalCents += line.product.priceCents * line.quantity;
		}
		return {
			filter: filter.value,
			lines: lines,
			count: count,
			totalCents: totalCents,
			showAll: () -> filter.set(CatalogFilter.All),
			showSystems: () -> filter.set(CatalogFilter.Systems),
			showTools: () -> filter.set(CatalogFilter.Tools),
			add: slug -> quantities.update(current -> adjustQuantity(current, slug, 1)),
			remove: slug -> quantities.update(current -> adjustQuantity(current, slug, -1)),
			clear: () -> quantities.set([])
		};
	}

	static function quantityFor(quantities:Array<CartQuantity>, slug:ProductSlug):Int {
		for (entry in quantities) {
			if (entry.slug == slug) {
				return entry.quantity;
			}
		}
		return 0;
	}

	static function buildLines(products:Array<CartProduct>, quantities:Array<CartQuantity>):Array<CartLine> {
		final lines:Array<CartLine> = [];
		for (product in products) {
			final quantity = quantityFor(quantities, product.slug);
			if (quantity > 0) {
				lines.push({product: product, quantity: quantity});
			}
		}
		return lines;
	}

	static function adjustQuantity(current:Array<CartQuantity>, slug:ProductSlug, delta:Int):Array<CartQuantity> {
		final next:Array<CartQuantity> = [];
		var found = false;
		for (entry in current) {
			if (entry.slug == slug) {
				found = true;
				final quantity = entry.quantity + delta;
				if (quantity > 0) {
					next.push({slug: slug, quantity: quantity});
				}
			} else {
				next.push(entry);
			}
		}
		if (!found && delta > 0) {
			next.push({slug: slug, quantity: delta});
		}
		return next;
	}
}
