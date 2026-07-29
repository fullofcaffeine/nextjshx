package client_components_react_lint_negative;

import genes.react.React.useMemo;
import genes.react.React.deps;

/** Haxe-valid control whose deliberately omitted capture must fail React lint. */
@:keep
class GeneratedMissingDependency {
	@:next.hook
	public static function useMissing(value:Int, label:String):String {
		return useMemo(() -> '$label:$value', deps(value));
	}
}
