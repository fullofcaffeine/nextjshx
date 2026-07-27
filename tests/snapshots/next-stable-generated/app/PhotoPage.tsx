import type {JSX} from "react"
import NextLink from "next/link"
import {Register} from "../genes/Register"
import type {PageProps} from "../nextjs/app/PageProps"

export type PhotoParams = {
	id: string
}

/**
 * Canonical hard-navigation owner for `/photo/[id]`.
 */
export class PhotoPage {
	static render(props: PageProps<PhotoParams, Readonly<Record<string, string | string[] | undefined>>>): JSX.Element {
		const p: JSX.Element = <p>Canonical Haxe photo route</p>;
		const tmp1: JSX.Element = <NextLink id="return-feed" href="/feed">Return to the feed</NextLink>;
		return <main id="canonical-photo">{p}{tmp1}</main>;
	}
	static href(params: PhotoParams): import('next').Route<`/photo/${string}`> {
		const __nextRoute0Params: PhotoParams = params;
		const s: string = __nextRoute0Params.id;
		const __nextRoute0Encoded0: string = encodeURIComponent(s);
		return `/photo/${__nextRoute0Encoded0}`;
	}
	static get __name__(): string {
		return "app.PhotoPage"
	}
	get __class__(): Function {
		return PhotoPage
	}
}
Register.setHxClass("app.PhotoPage", PhotoPage);
