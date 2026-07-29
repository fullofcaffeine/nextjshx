package client_components_negative;

import genes.react.React.useMemo;
import genes.react.React.deps;

@:keep
class RestMemoSnapshot {
	@:next.hook
	public static function useValue(value:Int):Int {
		return useMemo(function(...current:Int):Int {
			return value;
		}, deps(value));
	}
}
