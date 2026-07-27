package commerce.app;

import commerce.domain.Product;
import commerce.domain.Product.ProductSlug;
import commerce.domain.ProductCatalog.all;
import commerce.domain.ProductCatalog.find;
import genes.js.Async.await;
import genes.react.Element;
import js.lib.Error;
import js.lib.Promise;
import nextjs.app.PageMetadataProps;
import nextjs.app.PageProps;
import nextjs.components.NextImage;
import nextjs.components.NextLink;
import nextjs.raw.Navigation;
import nextjs.raw.components.ImageProps;
import nextjs.raw.metadata.Metadata;
import nextjs.route.SearchParams;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeProps;
import showcase.ui.Badge.BadgeVariant;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.SlottedButton;
import showcase.ui.Icons.ArrowRight;
import showcase.ui.Icons.Check;
import showcase.ui.Icons.IconProps;

typedef ProductParams = {
	final slug:ProductSlug;
}

/**
 * `@:next.page("products/[slug]")` checks this dynamic App Router page and
 * generates `ProductPage.href({slug: ...})`, keeping links and parameters in
 * the same closed `ProductSlug` domain.
 */
@:next.page("products/[slug]")
class ProductPage {
	public static function generateStaticParams():Array<ProductParams> {
		return all().map(product -> {slug: product.slug});
	}

	public static function generateMetadata(props:PageMetadataProps<ProductParams, SearchParams>):Promise<Metadata> {
		return props.params.then(params -> {
			final product = find(params.slug);
			final metadata:Metadata = product == null ? {
				title: "Object unavailable — Common Ground"
			} : {
				title: product.name + " — Common Ground",
				description: product.tagline
				};
			return metadata;
		});
	}

	/**
	 * `@:async` and `genes.js.Async.await` emit native async/await. Next sees
	 * the same Promise-returning Server Component it would receive from TSX;
	 * no Haxe scheduler or runtime wrapper is introduced.
	 */
	@:async
	public static function render(props:PageProps<ProductParams, SearchParams>):Promise<Element> {
		final params = await(props.params);
		final product = find(params.slug);
		return product == null ? missing() : renderProduct(product);
	}

	static function missing():Element {
		Navigation.notFound();
		throw new Error("next/navigation.notFound returned instead of interrupting control flow");
	}

	/**
	 * Renders a validated product with native Next Image and typed UI facades.
	 *
	 * Product lookup and not-found interruption are already complete, so this
	 * helper receives a closed domain value. Next retains image optimization,
	 * Link navigation, and Server Component rendering.
	 */
	static function renderProduct(product:Product):Element {
		final image:ImageProps = {
			src: product.image,
			alt: product.alt,
			width: 900,
			height: 900,
			sizes: "(max-width: 760px) 100vw, 55vw",
			priority: true
		};
		final badge:BadgeProps = {variant: BadgeVariant.Outline, className: "detail-badge"};
		final icon:IconProps = {size: 17, strokeWidth: 1.7};
		final includes = product.includes.map(item -> <li><Check {...icon} />{item}</li>);
		return <main className="product-detail">
			<header className="detail-header"><NextLink className="detail-mark" href={StorePage.href()}>Common Ground</NextLink><SlottedButton variant={ButtonVariant.Outline} className="detail-back" asChild><NextLink href={StorePage.href()}>Back to objects</NextLink></SlottedButton></header>
			<section className="detail-grid">
				<div className="detail-image"><NextImage {...image} /><span>{product.edition}</span></div>
				<div className="detail-copy"><Badge {...badge}>{product.category}</Badge><p className="detail-edition">{product.edition}</p><h1>{product.name}</h1><p className="detail-tagline">{product.tagline}</p><strong className="detail-price">{product.price.label()}</strong><p className="detail-description">{product.description}</p><a className="detail-cta" href={StorePage.href() + "#shop-catalog"}>Add from the collection <ArrowRight {...icon} /></a></div>
			</section>
			<section className="detail-specs"><div><span>FOOTPRINT</span><strong>{product.footprint}</strong></div><div><span>LIGHT</span><strong>{product.light}</strong></div><div><span>FIRST HARVEST</span><strong>{product.harvest}</strong></div></section>
			<section className="detail-includes"><p>IN THE BOX / 04</p><h2>Everything needed.<br />Nothing disposable.</h2><ul>{includes}</ul></section>
		</main>;
	}
}
