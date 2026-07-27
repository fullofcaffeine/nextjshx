import type {JSX} from "react"
import {Register} from "../genes/Register"
import type {ErrorProps} from "../nextjs/app/ErrorProps"

/**
 * Typed Haxe error boundary; the macro owns its required client directive.
 */
export class ErrorView {
	static render(props: ErrorProps): JSX.Element {
		const p: JSX.Element = <p id="haxe-error-message">{props.error.message}</p>;
		const button: JSX.Element = <button id="haxe-error-reset" onClick={props.reset}>Reset from Haxe</button>;
		return <main id="haxe-error-boundary">{p}{button}</main>;
	}
	static get __name__(): string {
		return "special_file_fixture.ErrorView"
	}
	get __class__(): Function {
		return ErrorView
	}
}
Register.setHxClass("special_file_fixture.ErrorView", ErrorView);
