import type {JSX} from "react"
import {Register} from "../genes/Register"

/**
 * Haxe-owned streamed fallback for the native loading proof page.
 */
export class LoadingView {
	static render(): JSX.Element {
		return <main id="haxe-loading">HAXE-LOADING-FALLBACK</main>;
	}
	static get __name__(): string {
		return "special_file_fixture.LoadingView"
	}
	get __class__(): Function {
		return LoadingView
	}
}
Register.setHxClass("special_file_fixture.LoadingView", LoadingView);
