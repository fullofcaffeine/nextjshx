package next_components;

import nextjs.raw.font.GoogleOptions.InterOptions;

class NegativeFontAxis {
	static function main():Void {
		final options:InterOptions = {axes: ["width"]};
		consume(options);
	}

	static function consume(_:InterOptions):Void {}
}
