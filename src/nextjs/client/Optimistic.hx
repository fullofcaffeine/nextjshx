package nextjs.client;

import nextjs.raw.react.UseOptimisticResult;

/**
 * Allocation-free intent-oriented view of React optimistic state.
 *
 * The abstract erases to React's existing tuple. `value` reads the projected
 * state and `apply` dispatches one closed application action; no wrapper object
 * or Haxe runtime helper is emitted.
 */
abstract Optimistic<State, Action>(UseOptimisticResult<State, Action>) {
	/** Current optimistic projection, or the latest passthrough state when idle. */
	public var value(get, never):State;

	inline function get_value():State {
		return this.first;
	}

	/** Applies one typed optimistic action through the authored reducer. */
	public inline function apply(action:Action):Void {
		this.second(action);
	}
}
