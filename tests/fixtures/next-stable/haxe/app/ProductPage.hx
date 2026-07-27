package app;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageMetadataProps;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.raw.metadata.Metadata;
import nextjs.raw.metadata.ResolvingMetadata;
import nextjs.route.SearchParams;

typedef ProductParams = {
	final slug:String;
}

/** Haxe-owned dynamic page with generated metadata and a closed static route set. */
@:next.page("products/[slug]")
@:next.query(app.ProductQuery)
class ProductPage {
	public static final segment = SegmentConfig.create({
		preferredRegion: ["iad1", "sfo1"],
		dynamicParams: false,
		revalidate: 60,
		maxDuration: 10
	});

	public static function generateMetadata(props:PageMetadataProps<ProductParams, SearchParams>, parent:ResolvingMetadata):Promise<Metadata> {
		final value:Metadata = {
			title: "Generated product metadata from Haxe",
			description: "Next.js invoked a typed Haxe metadata function for a generated route."
		};
		return Promise.resolve(value);
	}

	public static function generateStaticParams():Promise<Array<ProductParams>> {
		return Promise.resolve([{slug: "first"}, {slug: "second"}]);
	}

	public static function render(props:PageProps<ProductParams, SearchParams>):Element {
		return <main id={"haxe-product-page"}>
      <p>This product page and its static route list originated in typed Haxe.</p>
    </main>;
	}
}
