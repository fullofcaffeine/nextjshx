package client_components_negative;

import genes.react.Element;

typedef StaticMutationProps = {
	final label:String;
}

@:next.clientComponent
class StaticMutation {
	static var renders:Int = 0;

	public static function render(props:StaticMutationProps):Element {
		renders++;
		return <p>{props.label + renders}</p>;
	}
}
