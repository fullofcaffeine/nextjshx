package client_components_negative;

import genes.react.Element;

typedef UnversionedMapBoundaryProps = {
	final values:js.lib.Map<String, Int>;
}

/** Raw containers remain closed until selected through a versioned capability. */
@:next.clientComponent
class UnversionedMapProps {
	public static function render(_props:UnversionedMapBoundaryProps):Element {
		return <div>never emitted</div>;
	}
}
