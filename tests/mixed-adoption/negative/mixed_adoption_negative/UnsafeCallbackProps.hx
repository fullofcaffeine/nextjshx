package mixed_adoption_negative;

import genes.react.Element;

typedef UnsafeCallbackPropsShape = {
	final label:String;
	final onCommit:String->Void;
}

/**
 * A Server Component cannot pass an arbitrary callback through the generated
 * Server-to-Client boundary. Keep the callback inside the client graph or use
 * a separately reviewed Server Function reference.
 */
@:next.clientComponent
class UnsafeCallbackProps {
	public static function render(props:UnsafeCallbackPropsShape):Element {
		return <button>{props.label}</button>;
	}
}
