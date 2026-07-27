package client_components_negative;

import genes.react.Element;
import client_components_negative.HookBindings.ReviewedHooks;

typedef EventHandlerHookProps = {
	final label:String;
}

@:next.clientComponent
class EventHandlerHook {
	public static function render(props:EventHandlerHookProps):Element {
		final onClick = () -> {
			final state = ReviewedHooks.useCount();
			if (state.count < 0) {
				return;
			}
		};
		return <button type={"button"} onClick={onClick}>{props.label}</button>;
	}
}
