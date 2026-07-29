package client_components_negative;

import genes.react.React.useState;

/** State replacement remains checked against the inferred Haxe state type. */
class WrongStateReplacement {
	@:next.hook
	public static function useInvalid():Void {
		final count = useState(0);
		count.set("three");
	}
}
