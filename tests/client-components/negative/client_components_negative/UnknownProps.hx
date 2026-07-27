package client_components_negative;

import genes.react.Element;
import genes.ts.Unknown;

typedef UnknownBoundaryProps = {
	final payload:Unknown;
}

@:next.clientComponent
class UnknownProps {
	public static function render(props:UnknownBoundaryProps):Element {
		return <p>Unknown payload</p>;
	}
}
