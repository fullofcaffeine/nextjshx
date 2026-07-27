package nextjs.client;

#if macro
import haxe.macro.Expr;
#end

/**
 * Intent-oriented React surface for Haxe-authored Client Components and Hooks.
 *
 * Calls remain ordinary React calls after macro expansion. The semantic layer
 * adds early Haxe diagnostics and names state replacement separately from
 * functional update without introducing a parallel runtime.
 */
class React {
	/** Runs imperative optimistic or non-urgent updates in a React Transition. */
	public static macro function startTransition(scope:Expr):Expr {
		return nextjshx.client.ReactHooksMacro.startTransition(scope);
	}

	/** Reads a reviewed cached Promise or React Context using React `use`. */
	public static macro function use(resource:Expr):Expr {
		return nextjshx.client.ReactHooksMacro.use(resource);
	}

	/** Creates eager state when the supplied value is definitely non-callable. */
	public static macro function useState(initial:Expr):Expr {
		return nextjshx.client.ReactHooksMacro.useState(initial);
	}

	/** Creates lazy state, including function-valued state, from a pure initializer. */
	public static macro function useStateLazy(initializer:Expr):Expr {
		return nextjshx.client.ReactHooksMacro.useStateLazy(initializer);
	}

	/**
	 * Memoizes a calculation with one direct explicit dependency list.
	 *
	 * A zero-argument calculation keeps ordinary local/member dependencies
	 * familiar. For computed dependencies, name one inferred calculation
	 * parameter per dependency on an anonymous function or arrow calculation;
	 * the macro emits one shared scalar snapshot.
	 */
	public static macro function useMemo(calculate:Expr, dependencies:Expr):Expr {
		return nextjshx.client.ReactHooksMacro.useMemo(calculate, dependencies);
	}

	/** Memoizes a checked callback with one direct explicit dependency list. */
	public static macro function useCallback(callback:Expr, dependencies:Expr):Expr {
		return nextjshx.client.ReactHooksMacro.useCallback(callback, dependencies);
	}

	/** Creates a reducer-driven optimistic projection with a closed action type. */
	public static macro function useOptimistic(passthrough:Expr, reducer:Expr):Expr {
		return nextjshx.client.ReactHooksMacro.useOptimistic(passthrough, reducer);
	}

	/** Compile-time-only ordered dependency packaging consumed by a semantic Hook. */
	public static macro function deps(arguments:Array<Expr>):Expr {
		return nextjshx.client.ReactHooksMacro.deps(arguments);
	}
}
