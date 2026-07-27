package nextjs.client;

#if macro
import haxe.macro.Expr.ExprOf;
#end
import nextjs.raw.react.Dispatch;
import nextjs.raw.react.SetStateAction;
import nextjs.raw.react.UseStateResult;
import nextjshx.client.StateRuntime;

/**
 * Allocation-free semantic view of React state.
 *
 * `value`, `set`, and `update` name the three application intents without
 * exposing React's positional tuple or replacement/updater union. The abstract
 * erases to the tuple returned by React.
 */
abstract State<Value>(UseStateResult<Value>) {
	/** Current render's state value. */
	public var value(get, never):Value;

	inline function get_value():Value {
		return this.first;
	}

	/**
	 * Replaces the state value.
	 *
	 * The macro passes definitely non-callable expressions directly to React.
	 * Possibly callable expressions use React's required constant-updater form
	 * while preserving eager, exactly-once evaluation of the replacement.
	 */
	public macro function set<Value>(state:ExprOf<State<Value>>, next:ExprOf<Value>):ExprOf<Void> {
		return nextjshx.client.ReactHooksMacro.setState(state, next);
	}

	/** Applies a state transition to the previous value. */
	public inline function update(reducer:Value->Value):Void {
		this.second(reducer);
	}

	@:noCompletion
	private inline function __setDirect(next:Value):Void {
		this.second(next);
	}

	@:noCompletion
	private inline function __setPossiblyCallable(next:Value):Void {
		StateRuntime.replaceCallable(this.second, next);
	}
}
