package client_components_negative;

import genes.react.Element;

typedef ImpureDateProps = {
	final label:String;
}

@:next.clientComponent
class ImpureDate {
	public static function render(props:ImpureDateProps):Element {
		final value = Date.now();
		return <p>{props.label + value.toString()}</p>;
	}
}
