package client_components_negative;

import genes.react.Element;
import client_components_negative.HookBindings.ReviewedHooks;

typedef LoopHookProps = {
	final label:String;
	final values:Array<Int>;
}

@:next.clientComponent
class LoopHook {
	public static function render(props:LoopHookProps):Element {
		for (_ in props.values) {
			ReviewedHooks.useCount();
		}
		return <p>{props.label}</p>;
	}
}
