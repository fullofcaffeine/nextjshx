package client_components_negative;

import genes.react.Element;

typedef RawPromiseBoundaryProps = {
	final resource:js.lib.Promise<String>;
}

/** Ordinary Promises do not prove reviewed server/module ownership. */
@:next.clientComponent
class RawPromiseProps {
	public static function render(_props:RawPromiseBoundaryProps):Element {
		return <div>never emitted</div>;
	}
}
