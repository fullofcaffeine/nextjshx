package client_components_negative;

import genes.react.Element;

typedef ImpureRandomProps = {
	final label:String;
}

@:next.clientComponent
class ImpureRandom {
	public static function render(props:ImpureRandomProps):Element {
		final value = Math.random();
		return <p>{props.label + value}</p>;
	}
}
