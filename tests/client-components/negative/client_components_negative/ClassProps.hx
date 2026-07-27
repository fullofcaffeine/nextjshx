package client_components_negative;

import genes.react.Element;

class ClientSession {
	public final id:String;

	public function new(id:String) {
		this.id = id;
	}
}

typedef ClassBoundaryProps = {
	final session:ClientSession;
}

@:next.clientComponent
class ClassProps {
	public static function render(props:ClassBoundaryProps):Element {
		return <p>{props.session.id}</p>;
	}
}
