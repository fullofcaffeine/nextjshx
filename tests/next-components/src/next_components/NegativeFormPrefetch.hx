package next_components;

import nextjs.raw.components.FormProps;

class NegativeFormPrefetch {
	static function main():Void {
		final props:FormProps<String> = {action: "/search", prefetch: true};
		consume(props);
	}

	static function consume(_:FormProps<String>):Void {}
}
