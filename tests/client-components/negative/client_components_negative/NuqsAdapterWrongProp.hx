package client_components_negative;

import genes.react.Element;
import nextjs.raw.integrations.nuqs.NuqsAdapter;

private typedef NuqsAdapterWrongPropProps = {}

/** HXX validates the adapter option record before TSX generation. */
@:next.clientComponent
class NuqsAdapterWrongProp {
	public static function render(_props:NuqsAdapterWrongPropProps):Element {
		return <NuqsAdapter defaultOptions="merge"><span>Child</span></NuqsAdapter>;
	}

	static function main():Void {
		consume(render({}));
	}

	static function consume<Value>(value:Value):Void {}
}
