package client_components_negative;

import genes.react.Element;
import js.lib.Promise;
import nextjs.client.React.use;

typedef UncachedReactUseProps = {
	final label:String;
}

@:next.clientComponent
class UncachedReactUse {
	public static function render(props:UncachedReactUseProps):Element {
		final label = use(Promise.resolve(props.label));
		return <p>{label}</p>;
	}
}
