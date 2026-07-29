package client_components_negative;

import genes.react.React.useMemo;
import genes.react.React.deps;

@:keep
class MemoDependencyArity {
	@:next.hook
	public static function useDoubled(value:Int):Int {
		return useMemo((current, extra) -> current + extra, deps(value));
	}
}
