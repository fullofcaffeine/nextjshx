package client_components_negative;

import genes.react.React.useMemo;
import nextjs.raw.react.DependencyList;

/** Semantic memo dependencies must stay visibly inline for React tooling. */
class StoredMemoDependencies {
	@:next.hook
	public static function useDouble(value:Int):Int {
		final stored:DependencyList<Int> = [value];
		return useMemo(() -> value * 2, stored);
	}
}
