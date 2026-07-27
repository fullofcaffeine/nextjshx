package client_components_negative;

import genes.react.Element;
import client_components_negative.HookBindings.ReviewedHooks;

typedef NestedHookProps = {
	final label:String;
}

@:next.clientComponent
class NestedHook {
	public static function render(props:NestedHookProps):Element {
		final readLater = () -> ReviewedHooks.useCount();
		return <p>{props.label}</p>;
	}
}
