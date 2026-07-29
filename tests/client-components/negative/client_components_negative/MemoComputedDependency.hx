package client_components_negative;

import genes.react.React.useState;
import genes.react.React.useMemo;
import genes.react.React.deps;

@:keep
class MemoComputedDependency {
	@:next.hook
	public static function useDoubled(initial:Int):Int {
		final state = useState(initial);
		return useMemo(() -> state.value * 2, deps(state.value));
	}
}
