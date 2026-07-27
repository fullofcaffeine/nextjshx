package client_components_negative;

import genes.react.Element;

typedef RecursiveNode = {
	final label:String;
	final children:Array<RecursiveNode>;
}

typedef RecursiveBoundaryProps = {
	final root:RecursiveNode;
}

@:next.clientComponent
class RecursiveProps {
	public static function render(props:RecursiveBoundaryProps):Element {
		return <p>{props.root.label}</p>;
	}
}
