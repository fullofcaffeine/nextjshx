package client_components_negative;

import genes.react.React.useOptimistic;

/** Optimistic actions remain checked against the authored reducer input. */
class WrongOptimisticAction {
	@:next.hook
	public static function useInvalid():Void {
		final count = useOptimistic(0, (current:Int, amount:Int) -> current + amount);
		count.apply("three");
	}
}
