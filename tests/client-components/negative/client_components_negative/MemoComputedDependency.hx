package client_components_negative;

import nextjs.client.React;

@:keep
class MemoComputedDependency {
	@:next.hook
	public static function useDoubled(initial:Int):Int {
		final state = React.useState(initial);
		return React.useMemo(() -> state.value * 2, React.deps(state.value));
	}
}
