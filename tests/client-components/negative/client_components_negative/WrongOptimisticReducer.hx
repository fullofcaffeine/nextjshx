package client_components_negative;

import nextjs.client.React;

/** Optimistic reducers must return the exact passthrough state type. */
class WrongOptimisticReducer {
	@:next.hook
	public static function useInvalid():Void {
		React.useOptimistic(0, (_current:Int, _amount:Int) -> "not a count");
	}
}
