package client_components_negative;

import genes.react.Element;

typedef FunctionBoundaryProps = {
	final label:String;
	final onSelect:String->Void;
}

@:next.clientComponent
class FunctionProps {
	public static function render(props:FunctionBoundaryProps):Element {
		return <button>{props.label}</button>;
	}
}
