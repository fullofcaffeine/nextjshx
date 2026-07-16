import type {JSX} from "react"
import {Register} from "../genes/Register"

export class HelloView {
	static render(): JSX.Element {
		let h1: JSX.Element = <h1>Haxe → genes-ts → Next.js</h1>;
		let p: JSX.Element = <p>This production-rendered element originated in typed Haxe.</p>;
		return <main id="nextjshx-fixture">{h1}{p}</main>;
	}
	static get __name__(): string {
		return "app.HelloView"
	}
	get __class__(): Function {
		return HelloView
	}
}
Register.setHxClass("app.HelloView", HelloView);
