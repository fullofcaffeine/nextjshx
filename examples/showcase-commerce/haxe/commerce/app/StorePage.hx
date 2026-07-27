package commerce.app;

import commerce.client.CartHook.CartProduct;
import commerce.client.CartHook.CartProductCategory;
import commerce.client.ShopClient;
import commerce.domain.Product;
import commerce.domain.Product.ProductCategory;
import commerce.domain.ProductCatalog;
import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.components.NextLink;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeProps;
import showcase.ui.Badge.BadgeVariant;
import showcase.ui.Icons.IconProps;
import showcase.ui.Icons.Sprout;

using nextjs.client.ClientComponent;

@:next.page("")
class StorePage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final Shop = ShopClient.client();
		final products:Array<CartProduct> = ProductCatalog.all().map(toCartProduct);
		final badge:BadgeProps = {variant: BadgeVariant.Outline, className: "season-badge"};
		final icon:IconProps = {size: 20, strokeWidth: 1.7};
		return <main>
			<header className="shop-header">
				<NextLink className="shop-mark" href={StorePage.href()}><Sprout {...icon} /><strong>Common Ground</strong></NextLink>
				<nav aria-label="Shop navigation"><a href="#shop-catalog">Objects</a><a href="#principles">Principles</a><a href="#support">Support</a></nav>
				<span>GROWING SEASON / 2026</span>
			</header>
			<section className="shop-hero">
				<div className="hero-copy"><Badge {...badge}>Small-space horticulture</Badge><h1>Grow food.<br /><em>Keep the room.</em></h1><p>Quiet indoor systems and lasting seed tools for people who want a harvest—not another appliance.</p><a href="#shop-catalog">Shop the first collection ↘</a></div>
				<div className="hero-object" aria-label="Abstract modular indoor garden"><i className="pot pot-one"></i><i className="pot pot-two"></i><i className="pot pot-three"></i><span className="stem stem-one"></span><span className="stem stem-two"></span><span className="stem stem-three"></span><b>03 / OBJECTS FOR DAILY GROWING</b></div>
			</section>
			<Shop products={products} />
			<section id="principles" className="shop-principles"><p>OUR STANDARD / 04</p><h2>Less plastic.<br />More seasons.</h2><ol><li><span>01</span>Repairable pumps</li><li><span>02</span>Replaceable light bars</li><li><span>03</span>Food-safe reservoirs</li><li><span>04</span>Flat-pack service parts</li></ol></section>
			<footer id="support" className="shop-footer"><strong>Common Ground</strong><p>Objects for growing a little food, very well.</p><a href="mailto:grow@commonground.example">grow@commonground.example</a><small>Fictional store / NextJsHx showcase</small></footer>
		</main>;
	}

	static function toCartProduct(product:Product):CartProduct {
		return {
			slug: product.slug,
			name: product.name,
			edition: product.edition,
			category: product.category == ProductCategory.System ? CartProductCategory.Systems : CartProductCategory.Tools,
			price: product.price.label(),
			priceCents: product.price.cents(),
			image: product.image,
			alt: product.alt,
			tagline: product.tagline
		};
	}
}
