package next_components;

import nextjs.raw.components.ScriptProps;

class NegativeScriptStrategy {
	static function main():Void {
		final props:ScriptProps = {src: "/widget.js", strategy: "idle"};
		consume(props);
	}

	static function consume(_:ScriptProps):Void {}
}
