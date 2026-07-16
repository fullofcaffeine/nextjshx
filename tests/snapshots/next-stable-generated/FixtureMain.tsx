import {Register} from "./genes/Register"
import {HelloView} from "./app/HelloView"

export class FixtureMain {
	static main(): void {
		HelloView.render();
	}
	static get __name__(): string {
		return "FixtureMain"
	}
	get __class__(): Function {
		return FixtureMain
	}
}
Register.setHxClass("FixtureMain", FixtureMain);
