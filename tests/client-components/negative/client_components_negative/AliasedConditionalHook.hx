package client_components_negative;

import client_components_negative.HookBindings.ReviewedHooks.useCount as useReviewedCount;
import genes.react.Element;

typedef AliasedConditionalHookProps = {
	final enabled:Bool;
}

@:next.clientComponent
class AliasedConditionalHook {
	public static function render(props:AliasedConditionalHookProps):Element {
		if (props.enabled) {
			useReviewedCount();
		}
		return <p>Aliased conditional Hook</p>;
	}
}
