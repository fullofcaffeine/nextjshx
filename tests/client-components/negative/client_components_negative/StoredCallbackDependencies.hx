package client_components_negative;

import genes.react.React.useCallback;
import nextjs.raw.react.DependencyList;

class StoredCallbackDependencies {
	@:next.hook
	public static function useStored(value:Int):Int->Int {
		final dependencies:DependencyList<Int> = [value];
		return useCallback((amount:Int) -> value + amount, dependencies);
	}
}
