package client_components_negative;

import genes.react.Element;

typedef BadPathProps = {
	final label:String;
}

@:next.clientComponent("components/page")
class BadPath {
	public static function render(props:BadPathProps):Element {
		return <p>{props.label}</p>;
	}
}
