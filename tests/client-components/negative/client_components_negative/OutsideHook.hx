package client_components_negative;

import client_components_negative.HookBindings.ReviewedHooks;

class OutsideHook {
	public static function read():Int {
		return ReviewedHooks.useCount().count;
	}
}
