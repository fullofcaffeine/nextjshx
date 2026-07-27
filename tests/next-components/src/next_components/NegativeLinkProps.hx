package next_components;

import nextjs.raw.components.LinkProps;

class NegativeLinkProps {
	static function main():Void {
		final props:LinkProps<String> = {replace: true};
		consume(props);
	}

	static function consume(_:LinkProps<String>):Void {}
}
