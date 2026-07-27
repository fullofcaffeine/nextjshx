package client_components_react_lint_negative;

import nextjs.client.React;

/** Haxe-valid control whose deliberately omitted capture must fail React lint. */
@:keep
class GeneratedMissingDependency {
	@:next.hook
	public static function useMissing(value:Int, label:String):String {
		return React.useMemo(() -> '$label:$value', React.deps(value));
	}
}
