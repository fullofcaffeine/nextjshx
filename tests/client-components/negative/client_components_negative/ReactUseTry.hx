package client_components_negative;

import genes.react.Element;
import client_components_negative.HookBindings.NegativeCachedResource;
import nextjs.client.React;

typedef ReactUseTryProps = {
	final label:String;
}

@:next.clientComponent
class ReactUseTry {
	public static function render(props:ReactUseTryProps):Element {
		try {
			final label = React.use(NegativeCachedResource.label());
			return <p>{label}</p>;
		} catch (_:haxe.Exception) {
			return <p>{props.label}</p>;
		}
	}
}
