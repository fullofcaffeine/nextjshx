package client_components_negative;

import genes.react.Element;
import client_components_negative.HookBindings.ReviewedHooks;

typedef ConditionalHookProps = {
	final enabled:Bool;
}

@:next.clientComponent
class ConditionalHook {
	public static function render(props:ConditionalHookProps):Element {
		if (props.enabled) {
			ReviewedHooks.useCount();
		}
		return <p>Conditional Hook</p>;
	}
}
