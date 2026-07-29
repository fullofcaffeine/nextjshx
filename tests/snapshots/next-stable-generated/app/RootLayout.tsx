import type {JSX} from "react"
import {Register} from "../genes/Register"
import type {NoParams} from "../nextjs/route/NoParams"

/**
 * Closed projection of the root layout's immediate `@modal` slot.
 */
export type RootLayoutProps = {
	children: import('react').ReactNode,
	modal: import('react').ReactNode,
	params: globalThis.Promise<NoParams>
}

/**
 * Haxe-owned root shell reached through a generated Next-native adapter.
 */
export class RootLayout {
	static render(props: RootLayoutProps): JSX.Element {
		const header: JSX.Element = <header id="nextjshx-fixture"><h1>Haxe → genes-ts → Next.js</h1></header>;
		const props1: import('react').ReactNode = props.children;
		const div: JSX.Element = <div id="parallel-modal-slot">{props.modal}</div>;
		return <html lang="en"><body>{header}{props1}{div}</body></html>;
	}
	static get __name__(): string {
		return "app.RootLayout"
	}
	get __class__(): Function {
		return RootLayout
	}
}
Register.setHxClass("app.RootLayout", RootLayout);
