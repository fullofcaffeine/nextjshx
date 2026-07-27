package dnd_kit;

import genes.react.Element;

/** Intrinsic refs reject ordinary values at the HXX source span. */
class WrongRefValue {
	static function main():Void {
		consume(render());
	}

	public static function render():Element {
		return <li ref="row">Invalid ref</li>;
	}

	static function consume<T>(_value:T):Void {}
}
