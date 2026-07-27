import type {JSX} from "react"
import {Register} from "../genes/Register"

/**
 * Haxe-owned segment fallback reached through Next's native notFound API.
 */
export class NotFoundView {
	static render(): JSX.Element {
		return <main id="haxe-not-found">HAXE-NOT-FOUND</main>;
	}
	static get __name__(): string {
		return "special_file_fixture.NotFoundView"
	}
	get __class__(): Function {
		return NotFoundView
	}
}
Register.setHxClass("special_file_fixture.NotFoundView", NotFoundView);
