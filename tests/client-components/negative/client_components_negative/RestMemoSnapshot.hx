package client_components_negative;

import nextjs.client.React;

@:keep
class RestMemoSnapshot {
	@:next.hook
	public static function useValue(value:Int):Int {
		return React.useMemo(function(...current:Int):Int {
			return value;
		}, React.deps(value));
	}
}
