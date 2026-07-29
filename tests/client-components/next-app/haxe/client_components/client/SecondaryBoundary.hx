package client_components.client;

import genes.react.Element;
import nextjs.client.React.use;

/** Module anchor proving secondary Haxe types retain their full identity. */
class SecondaryBoundary {}

typedef NestedToggleProps = {
	final label:String;
	final showCached:Bool;
}

/** A secondary type must not collide with a same-named primary type. */
@:next.clientComponent
class NestedToggle {
	public static function render(props:NestedToggleProps):Element {
		var label = props.label;
		for (resource in CachedResource.labels()) {
			if (props.showCached) {
				label = use(resource);
			}
		}
		return <button type={"button"}>{label}</button>;
	}
}
