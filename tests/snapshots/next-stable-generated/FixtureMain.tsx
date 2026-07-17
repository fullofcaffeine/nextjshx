import {Register} from "./genes/Register"

export class FixtureMain {
	static main(): void {
	}
	static get __name__(): string {
		return "FixtureMain"
	}
	get __class__(): Function {
		return FixtureMain
	}
}
Register.setHxClass("FixtureMain", FixtureMain);
