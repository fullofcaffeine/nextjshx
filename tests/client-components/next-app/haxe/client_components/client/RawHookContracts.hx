package client_components.client;

import js.lib.Promise;
import nextjs.raw.react.DependencyList;
import nextjs.raw.react.React;
import nextjs.raw.types.UndefinedValue;

/** Positive evidence that the faithful raw tuple API remains precisely typed. */
@:keep
class RawHookContracts {
	@:next.hook
	public static function useRawState(initial:Int):Int {
		final state = React.useState(initial);
		state.second(3);
		state.second(previous -> previous + 1);
		return state.first;
	}

	@:next.hook
	public static function useUndefinedState():UndefinedValue {
		final state = React.useState();
		return state.first;
	}

	@:next.hook
	public static function useRawMemo(value:Int):Int {
		final dependencies:DependencyList<Int> = [value];
		return React.useMemo(() -> value * 2, dependencies);
	}

	@:next.hook
	public static function useRawCallback(value:Int):Int {
		final dependencies:DependencyList<Int> = [value];
		final increment = React.useCallback((amount:Int) -> value + amount, dependencies);
		return increment(2);
	}

	@:next.hook
	public static function useRawIdentity():String {
		return React.useId();
	}

	@:next.hook
	public static function useRawRef(initial:Int):Int {
		final reference = React.useRef(initial);
		reference.current += 1;
		return reference.current;
	}

	@:next.hook
	public static function useRawExternalStore():Bool {
		return React.useSyncExternalStore(listener -> {
			listener();
			return () -> {};
		}, () -> true, () -> true);
	}

	@:next.hook
	public static function useRawActionState(initial:Int):Int {
		final action = React.useActionState((state:Int, amount:Int) -> Promise.resolve(state + amount), initial);
		action.second(2);
		return action.first + (action.third ? 1 : 0);
	}

	@:next.hook
	public static function useRawOptimistic(initial:Int):Int {
		final optimistic = React.useOptimistic(initial, (current:Int, amount:Int) -> current + amount);
		optimistic.second(2);
		return optimistic.first;
	}

	@:next.hook
	public static function useRawOptimisticReplacement(initial:Int):Int {
		final optimistic = React.useOptimistic(initial);
		optimistic.second(3);
		optimistic.second(previous -> previous + 1);
		return optimistic.first;
	}
}
