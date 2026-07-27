package client_components_negative;

import genes.react.Element;
import js.lib.Promise;

typedef AsyncBoundaryProps = {
	final label:String;
}

@:next.clientComponent
class AsyncRender {
	public static function render(props:AsyncBoundaryProps):Promise<Element> {
		return Promise.resolve(<p>{props.label}</p>);
	}
}
