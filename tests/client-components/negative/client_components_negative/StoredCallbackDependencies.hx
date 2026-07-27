package client_components_negative;

import nextjs.client.React;
import nextjs.raw.react.DependencyList;

class StoredCallbackDependencies {
	@:next.hook
	public static function useStored(value:Int):Int->Int {
		final dependencies:DependencyList<Int> = [value];
		return React.useCallback((amount:Int) -> value + amount, dependencies);
	}
}
