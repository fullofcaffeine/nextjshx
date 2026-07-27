import type {JSX} from "react"
import {Register} from "../genes/Register"
import type {PageProps} from "../nextjs/app/PageProps"
import type {PhotoParams} from "./PhotoPage"

/**
 * Soft-navigation-only presentation of the canonical photo route.
 */
export class InterceptedPhotoPage {
	static render(props: PageProps<PhotoParams, Readonly<Record<string, string | string[] | undefined>>>): JSX.Element {
		return <dialog id="photo-modal" open><p>Intercepted Haxe photo modal</p></dialog>;
	}
	static href(params: PhotoParams): import('next').Route<`/photo/${string}`> {
		const __nextRoute0Params: PhotoParams = params;
		const s: string = __nextRoute0Params.id;
		const __nextRoute0Encoded0: string = encodeURIComponent(s);
		return `/photo/${__nextRoute0Encoded0}`;
	}
	static get __name__(): string {
		return "app.InterceptedPhotoPage"
	}
	get __class__(): Function {
		return InterceptedPhotoPage
	}
}
Register.setHxClass("app.InterceptedPhotoPage", InterceptedPhotoPage);
