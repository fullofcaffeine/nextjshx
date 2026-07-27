package client_components_negative;

import nextjs.client.React;

/** State replacement remains checked against the inferred Haxe state type. */
class WrongStateReplacement {
	@:next.hook
	public static function useInvalid():Void {
		final count = React.useState(0);
		count.set("three");
	}
}
