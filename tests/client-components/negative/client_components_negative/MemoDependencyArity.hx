package client_components_negative;

import nextjs.client.React;

@:keep
class MemoDependencyArity {
	@:next.hook
	public static function useDoubled(value:Int):Int {
		return React.useMemo((current, extra) -> current + extra, React.deps(value));
	}
}
