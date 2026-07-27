package next_components;

import nextjs.raw.components.ImageProps;

class NegativeImageProps {
	static function main():Void {
		final props:ImageProps = {src: "/hero.png", width: 640, height: 360};
		consume(props);
	}

	static function consume(_:ImageProps):Void {}
}
