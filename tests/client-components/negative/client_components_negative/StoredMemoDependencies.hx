package client_components_negative;

import nextjs.client.React;
import nextjs.raw.react.DependencyList;

/** Semantic memo dependencies must stay visibly inline for React tooling. */
class StoredMemoDependencies {
	@:next.hook
	public static function useDouble(value:Int):Int {
		final stored:DependencyList<Int> = [value];
		return React.useMemo(() -> value * 2, stored);
	}
}
