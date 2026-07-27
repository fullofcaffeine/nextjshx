package dnd_kit;

import genes.react.Element;
import js.html.InputElement;

/** A callback restricted to inputs cannot be attached to a list item. */
class WrongRefTarget {
	static function main():Void {
		consume(render());
	}

	public static function render():Element {
		return <li ref={inputOnly}>Invalid target</li>;
	}

	static function inputOnly(_element:Null<InputElement>):Void {}

	static function consume<T>(_value:T):Void {}
}
