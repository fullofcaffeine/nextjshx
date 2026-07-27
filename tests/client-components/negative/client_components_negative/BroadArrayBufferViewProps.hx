package client_components_negative;

import genes.react.Element;

typedef BroadArrayBufferViewBoundaryProps = {
	final bytes:js.lib.ArrayBufferView;
}

/** The broad view interface cannot identify a supported concrete typed array. */
@:next.clientComponent
class BroadArrayBufferViewProps {
	public static function render(_props:BroadArrayBufferViewBoundaryProps):Element {
		return <div>never emitted</div>;
	}
}
