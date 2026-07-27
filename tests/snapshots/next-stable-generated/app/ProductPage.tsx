import type {JSX} from "react"
import {Register} from "../genes/Register"
import type {PageMetadataProps} from "../nextjs/app/PageMetadataProps"
import type {PageProps} from "../nextjs/app/PageProps"
import type {ProductQuery} from "./ProductQuery"

export type ProductParams = {
	slug: string
}

/**
 * Haxe-owned dynamic page with generated metadata and a closed static route set.
 */
export class ProductPage {
	static generateMetadata(props: PageMetadataProps<ProductParams, Readonly<Record<string, string | string[] | undefined>>>, parent: Promise<Awaited<import('next').ResolvingMetadata>>): Promise<import('next').Metadata> {
		const value: import('next').Metadata = {"title": "Generated product metadata from Haxe", "description": "Next.js invoked a typed Haxe metadata function for a generated route."};
		return Promise.resolve(value);
	}
	static generateStaticParams(): Promise<ProductParams[]> {
		return Promise.resolve([{"slug": "first"}, {"slug": "second"}]);
	}
	static render(props: PageProps<ProductParams, Readonly<Record<string, string | string[] | undefined>>>): JSX.Element {
		return <main id="haxe-product-page"><p>This product page and its static route list originated in typed Haxe.</p></main>;
	}
	static href(params: ProductParams): import('next').Route<`/products/${string}`> {
		const __nextRoute0Params: ProductParams = params;
		const s: string = __nextRoute0Params.slug;
		const __nextRoute0Encoded0: string = encodeURIComponent(s);
		return `/products/${__nextRoute0Encoded0}`;
	}
	static hrefWithQuery(params: ProductParams, query: ProductQuery): import('next').Route<`/products/${string}` | `${Extract<`/products/${string}`, string>}?${string}`> {
		const __nextRoute0Params: ProductParams = params;
		const s: string = __nextRoute0Params.slug;
		const __nextRoute0Encoded0: string = encodeURIComponent(s);
		const __nextQuery0Href: Extract<`/products/${string}`, string> = `/products/${__nextRoute0Encoded0}`;
		const __nextQuery0Value: ProductQuery = query;
		const __nextQuery0Params: globalThis.URLSearchParams = new URLSearchParams();
		__nextQuery0Params.append("page", (__nextQuery0Value.page == null) ? "null" : "" + __nextQuery0Value.page);
		let __nextQuery0Optional1: boolean | undefined = __nextQuery0Value.preview;
		const __nextQuery0Absent1: boolean = (__nextQuery0Optional1) === undefined;
		if (!__nextQuery0Absent1) {
			__nextQuery0Params.append("preview", (__nextQuery0Optional1) ? "true" : "false");
		};
		let _g: number = 0;
		const _g1: string[] = __nextQuery0Value.tags;
		while (_g < _g1.length) {
			const __nextQuery0Item2: string = _g1[_g]!;
			++_g;
			__nextQuery0Params.append("tag", (__nextQuery0Item2 == null) ? "null" : "" + __nextQuery0Item2);
		};
		const __nextQuery0Encoded: string = __nextQuery0Params.toString();
		if (__nextQuery0Encoded == "") {
			return __nextQuery0Href;
		} else {
			return `${__nextQuery0Href}?${__nextQuery0Encoded}`;
		};
	}
	static get __name__(): string {
		return "app.ProductPage"
	}
	get __class__(): Function {
		return ProductPage
	}
}
Register.setHxClass("app.ProductPage", ProductPage);
