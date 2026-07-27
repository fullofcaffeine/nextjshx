package client_components_negative;

import genes.react.Element;
import client_components_negative.HookBindings.ReviewedHooks;

typedef TryHookProps = {
	final label:String;
}

@:next.clientComponent
class TryHook {
	public static function render(props:TryHookProps):Element {
		try {
			ReviewedHooks.useCount();
		} catch (_:haxe.Exception) {}
		return <p>{props.label}</p>;
	}
}
