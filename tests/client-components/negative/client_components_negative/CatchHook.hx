package client_components_negative;

import genes.react.Element;
import client_components_negative.HookBindings.ReviewedHooks;

typedef CatchHookProps = {
	final label:String;
}

@:next.clientComponent
class CatchHook {
	public static function render(props:CatchHookProps):Element {
		try {
			throw new haxe.Exception("fixture");
		} catch (_:haxe.Exception) {
			ReviewedHooks.useCount();
		}
		return <p>{props.label}</p>;
	}
}
