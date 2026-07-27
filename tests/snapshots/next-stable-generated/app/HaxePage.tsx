import type {JSX} from "react"
import {Std} from "../Std"
import {Register} from "../genes/Register"
import type {PageProps} from "../nextjs/app/PageProps"
import type {NoParams} from "../nextjs/route/NoParams"

/**
 * Haxe-owned `/haxe` page reached through a generated Next-native adapter.
 */
export class HaxePage {
	declare static metadata: import('next').Metadata;
	static render(props: PageProps<NoParams, Readonly<Record<string, string | string[] | undefined>>>): JSX.Element {
		const preview: boolean | undefined = undefined;
		const __nextQuery0Value_page: number = 2;
		const __nextQuery0Value_preview: boolean | undefined = preview;
		const __nextQuery0Value_tags: string[] = ["haxe next", "typed"];
		const __nextRoute0Params_slug: string = "first";
		const s: string = __nextRoute0Params_slug;
		const __nextRoute0Encoded0: string = encodeURIComponent(s);
		const __nextQuery0Href: Extract<`/products/${string}`, string> = `/products/${__nextRoute0Encoded0}`;
		const __nextQuery0Params: globalThis.URLSearchParams = new URLSearchParams();
		__nextQuery0Params.append("page", Std.string(__nextQuery0Value_page));
		let __nextQuery0Optional1: boolean | undefined = __nextQuery0Value_preview;
		const __nextQuery0Absent1: boolean = (__nextQuery0Optional1) === undefined;
		if (!__nextQuery0Absent1) {
			__nextQuery0Params.append("preview", (__nextQuery0Optional1) ? "true" : "false");
		};
		let _g: number = 0;
		const _g1: string[] = __nextQuery0Value_tags;
		while (_g < _g1.length) {
			const __nextQuery0Item2: string = _g1[_g]!;
			++_g;
			__nextQuery0Params.append("tag", Std.string(__nextQuery0Item2));
		};
		const __nextQuery0Encoded: string = __nextQuery0Params.toString();
		const productHref: import('next').Route<`/products/${string}` | `${Extract<`/products/${string}`, string>}?${string}`> = (__nextQuery0Encoded == "") ? __nextQuery0Href : `${__nextQuery0Href}?${__nextQuery0Encoded}`;
		return <main id="haxe-page"><p>This page implementation originated in typed Haxe.</p><a id="typed-query-link" href={productHref}>Typed product query</a></main>;
	}
	static href(): import('next').Route<"/haxe"> {
		return "/haxe";
	}
	static get __name__(): string {
		return "app.HaxePage"
	}
	get __class__(): Function {
		return HaxePage
	}
}
Register.setHxClass("app.HaxePage", HaxePage);


HaxePage.metadata = {"title": "Static metadata from Haxe", "description": "A typed Haxe field becomes a native Next.js metadata export."}
