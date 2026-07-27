import type {JSX} from "react"
import {Register} from "../genes/Register"

/**
 * Explicit Next 16 hard-navigation fallback for the root `@modal` slot.
 */
export class ModalDefault {
	static render(): JSX.Element {
		return <span id="modal-default">No active modal</span>;
	}
	static get __name__(): string {
		return "app.ModalDefault"
	}
	get __class__(): Function {
		return ModalDefault
	}
}
Register.setHxClass("app.ModalDefault", ModalDefault);
