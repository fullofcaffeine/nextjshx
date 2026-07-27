import type {JSX} from "react"
import NextLink from "next/link"
import {Register} from "../genes/Register"
import type {PageProps} from "../nextjs/app/PageProps"
import type {NoParams} from "../nextjs/route/NoParams"

/**
 * Canonical feed retained behind an intercepted photo during soft navigation.
 */
export class FeedPage {
	static render(props: PageProps<NoParams, Readonly<Record<string, string | string[] | undefined>>>): JSX.Element {
		const h2: JSX.Element = <h2>Typed photo feed</h2>;
		const __nextRoute0Params_id: string = "42";
		const s: string = __nextRoute0Params_id;
		const __nextRoute0Encoded0: string = encodeURIComponent(s);
		const tmp1: JSX.Element = <NextLink id="open-photo" href={`/photo/${__nextRoute0Encoded0}`}>Open photo 42</NextLink>;
		return <main id="feed-page">{h2}{tmp1}</main>;
	}
	static href(): import('next').Route<"/feed"> {
		return "/feed";
	}
	static get __name__(): string {
		return "app.FeedPage"
	}
	get __class__(): Function {
		return FeedPage
	}
}
Register.setHxClass("app.FeedPage", FeedPage);
