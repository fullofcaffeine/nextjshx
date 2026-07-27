package client_components_negative;

import genes.react.Element;

typedef RawClientProps = {
	final label:String;
}

@:next.clientComponent
class RawClient {
	public static function render(props:RawClientProps):Element {
		return <p>{props.label}</p>;
	}
}
