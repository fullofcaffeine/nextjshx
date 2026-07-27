package client_components_negative;

import nextjs.client.React;

@:keep
class NamedMemoSnapshot {
	@:next.hook
	public static function useDoubled(value:Int):Int {
		return React.useMemo(function calculate(current:Int):Int {
			return current * 2;
		}, React.deps(value));
	}
}
