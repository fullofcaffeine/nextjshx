package commerce.domain;

import commerce.domain.Product.ProductCategory;
import commerce.domain.Product.ProductSlug;

/**
 * Returns the deterministic catalogue shared by listing, detail, and metadata.
 *
 * This is immutable module data, not an object with identity or lifecycle, so
 * a module function matches the equivalent TypeScript data module. The closed
 * `Product` shape keeps every consumer synchronized while Next.js remains
 * responsible for prerendering and image optimization.
 */
function all():Array<Product> {
	return [
		{
			slug: "frame-window-farm",
			name: "Frame 01",
			edition: "Window farm",
			category: ProductCategory.System,
			price: 18900,
			tagline: "A productive window, without the plastic appliance look.",
			description: "A powder-coated frame, quiet recirculating reservoir, and full-spectrum bar sized for herbs and tender greens. Designed to live with furniture rather than beside it.",
			image: "/products/frame-01.svg",
			alt: "Terracotta indoor growing frame with three planting trays",
			footprint: "42 × 18 cm",
			light: "24 W / dimmable",
			harvest: "18–28 days",
			includes: ["Aluminium frame", "Three grow trays", "Quiet reservoir", "Full-spectrum light"]
		},
		{
			slug: "mist-column",
			name: "Mist Column",
			edition: "Nine-site tower",
			category: ProductCategory.System,
			price: 24800,
			tagline: "Nine plants. The footprint of a dinner plate.",
			description: "A compact aeroponic column for kitchens that think vertically. Each planting collar lifts free for cleaning, while the internal pump runs on a measured five-minute cycle.",
			image: "/products/mist-column.svg",
			alt: "Olive green indoor growing column with leafy plants",
			footprint: "Ø 29 × 82 cm",
			light: "36 W / halo",
			harvest: "21–35 days",
			includes: ["Nine-site column", "Timer pump", "Halo light", "Starter collars"]
		},
		{
			slug: "soil-block-press",
			name: "Block Press",
			edition: "Seed tool / 20 mm",
			category: ProductCategory.Tool,
			price: 4600,
			tagline: "Start seedlings without a single-use cell tray.",
			description: "A weighty stainless press that makes twenty even soil blocks per pull. The open base releases cleanly, keeping roots air-pruned and transplant shock low.",
			image: "/products/block-press.svg",
			alt: "Stainless steel soil block press on a cobalt background",
			footprint: "16 × 8 cm",
			light: "None required",
			harvest: "20 blocks / pull",
			includes: ["Stainless press", "20 mm pins", "Depth plate", "Care brush"]
		}
	];
}

/** Resolves a route slug without claiming that every incoming value exists. */
function find(slug:ProductSlug):Null<Product> {
	for (product in all()) {
		if (product.slug == slug) {
			return product;
		}
	}
	return null;
}
