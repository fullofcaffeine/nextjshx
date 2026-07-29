package client_components_negative;

import genes.react.React.useMemo;
import genes.react.React.deps;

@:keep
class NamedMemoSnapshot {
	@:next.hook
	public static function useDoubled(value:Int):Int {
		return useMemo(function calculate(current:Int):Int {
			return current * 2;
		}, deps(value));
	}
}
