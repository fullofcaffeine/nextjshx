package nextjs.raw.react;

import haxe.extern.EitherType;
import js.lib.Promise;
import nextjs.raw.types.UndefinedValue;

/** Faithful reviewed binding for React APIs with special call semantics. */
extern class React {
	/** Runs non-urgent updates in an ordinary React Transition. */
	@:jsRequire("react", "startTransition")
	static function startTransition(scope:Void->Void):Void;

	@:next.reactUse
	@:jsRequire("react", "use")
	@:overload(function<T>(resource:Context<T>):T {})
	static function use<T>(resource:Promise<T>):T;

	/**
	 * Faithful React state primitive.
	 *
	 * React interprets callable values as lazy initializers and callable dispatch
	 * arguments as updaters. Prefer `nextjs.client.React` when authoring Haxe so
	 * replacement and lazy-initializer intent remain unambiguous.
	 *
	 * `@:ts.explicitTypeArguments` preserves the exact state type already chosen
	 * by Haxe when TypeScript cannot recover it from the emitted arguments. That
	 * matters for the zero-argument overload, which must emit
	 * `useState<undefined>()`, and for deliberately raw nullable calls. It is a
	 * compile-time genes-ts contract: it adds no helper or runtime behavior.
	 */
	@:next.hook
	@:ts.explicitTypeArguments
	@:jsRequire("react", "useState")
	@:overload(function():UseStateResult<UndefinedValue> {})
	static function useState<State>(initialState:EitherType<State, Void->State>):UseStateResult<State>;

	/** Faithful React memoization primitive with a closed dependency element type. */
	@:next.hook
	@:jsRequire("react", "useMemo")
	static function useMemo<Value, Dependency>(calculate:Void->Value, dependencies:DependencyList<Dependency>):Value;

	/** Faithful React callback memoization primitive for checked function arities. */
	@:next.hook
	@:jsRequire("react", "useCallback")
	@:overload(function<Argument, Result, Dependency>(callback:Argument->Result, dependencies:DependencyList<Dependency>):Argument->Result {})
	@:overload(function<First, Second, Result, Dependency>(callback:(First, Second) -> Result,
		dependencies:DependencyList<Dependency>):(First, Second) -> Result {})
	static function useCallback<Result, Dependency>(callback:Void->Result, dependencies:DependencyList<Dependency>):Void->Result;

	/** Stable opaque identifier for hydration-safe accessibility relationships. */
	@:next.hook
	@:jsRequire("react", "useId")
	static function useId():String;

	/** Stable mutable cell whose writes do not schedule a render. */
	@:next.hook
	@:jsRequire("react", "useRef")
	static function useRef<Value>(initialValue:Value):RefObject<Value>;

	/** Subscribes React to a precisely typed external mutable store. */
	@:next.hook
	@:jsRequire("react", "useSyncExternalStore")
	static function useSyncExternalStore<Snapshot>(subscribe:(Void->Void)->(Void->Void), getSnapshot:Void->Snapshot,
		?getServerSnapshot:Void->Snapshot):Snapshot;

	/** React 19 action state with an explicit payload and pending flag. */
	@:next.hook
	@:jsRequire("react", "useActionState")
	@:overload(function<State, Payload>(action:(State, Payload) -> Promise<State>, initialState:State,
		?permalink:String):UseActionStateResult<State, Payload> {})
	static function useActionState<State, Payload>(action:(State, Payload) -> State, initialState:State,
		?permalink:String):UseActionStateResult<State, Payload>;

	/** Faithful React optimistic-state primitive. */
	@:next.hook
	@:jsRequire("react", "useOptimistic")
	@:overload(function<State>(passthrough:State):UseOptimisticResult<State, SetStateAction<State>> {})
	static function useOptimistic<State, Action>(passthrough:State, reducer:(State, Action) -> State):UseOptimisticResult<State, Action>;
}
