package client_components_negative;

import genes.react.Element;

typedef LocalSymbolBoundaryProps = {
	final marker:js.lib.Symbol;
}

/** Raw symbols do not prove global Symbol.for registry provenance. */
@:next.clientComponent
class LocalSymbolProps {
	public static function render(_props:LocalSymbolBoundaryProps):Element {
		return <div>never emitted</div>;
	}
}
