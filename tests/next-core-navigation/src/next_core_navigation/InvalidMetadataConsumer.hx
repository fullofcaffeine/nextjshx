package next_core_navigation;

import nextjs.raw.metadata.Metadata;
import nextjs.raw.Navigation;

typedef InvalidParams = {
	final id:Int;
}

/**
 * Haxe deliberately accepts the raw structural escape hatch; Next's canonical
 * Metadata projection must reject this invalid nested value in strict TS.
 */
class InvalidMetadataConsumer {
	static function main():Void {
		final invalid:Metadata = {
			openGraph: {title: {notAValidTitle: true}}
		};
		final invalidParams:InvalidParams = Navigation.useParams();
		consume(invalid);
		consumeParams(invalidParams);
	}

	static function consume(_:Metadata):Void {}

	static function consumeParams(_:InvalidParams):Void {}
}
