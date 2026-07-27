package client_components_negative;

import genes.react.Element;
import client_components_negative.HookBindings.ReviewedHooks;

typedef AfterReturnHookProps = {
	final enabled:Bool;
}

@:next.clientComponent
class AfterReturnHook {
	public static function render(props:AfterReturnHookProps):Element {
		if (props.enabled) {
			return <p>Early</p>;
		}
		final state = ReviewedHooks.useCount();
		return <p>{state.count}</p>;
	}
}
