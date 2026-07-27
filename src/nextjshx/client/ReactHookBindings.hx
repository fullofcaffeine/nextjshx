package nextjshx.client;

import nextjs.client.CachedPromise;
import nextjs.client.flight.v19.FlightPromise;
import nextjs.client.Optimistic;
import nextjs.client.State;
import nextjs.raw.react.Context;
import nextjs.raw.react.DependencyList;

/**
 * Internal exact bindings used after the semantic macros establish intent.
 * Application code should use `nextjs.client.React`.
 */
@:noCompletion
extern class ReactHookBindings {
	@:jsRequire("react", "startTransition")
	static function startTransition(scope:Void->Void):Void;

	@:next.reactUse
	@:jsRequire("react", "use")
	@:overload(function<T>(resource:Context<T>):T {})
	@:overload(function<T>(resource:FlightPromise<T>):T {})
	static function use<T>(resource:CachedPromise<T>):T;

	@:next.hook
	@:jsRequire("react", "useState")
	static function useStateValue<Value>(initial:Value):State<Value>;

	/**
	 * State binding for weak TypeScript inference sites selected by the semantic
	 * macro, currently an explicitly typed `null` literal or a Haxe enum
	 * abstract whose TypeScript literal initializer would otherwise widen to
	 * its primitive storage type.
	 *
	 * Haxe has already established the closed `Value`, but emitted TypeScript
	 * would otherwise infer only `null` or the enum abstract's primitive backing
	 * type. `@:ts.explicitTypeArguments` opts this direct extern call into the
	 * genes-ts call-site preservation contract used by the semantic macro.
	 * Keeping this as a separate binding lets ordinary values retain
	 * handwritten-style `useState(initial)` output; neither binding creates a
	 * runtime wrapper.
	 */
	@:next.hook
	@:ts.explicitTypeArguments
	@:jsRequire("react", "useState")
	static function useStateContextual<Value>(initial:Value):State<Value>;

	@:next.hook
	@:jsRequire("react", "useState")
	static function useStateLazy<Value>(initializer:Void->Value):State<Value>;

	@:next.hook
	@:jsRequire("react", "useMemo")
	static function useMemo<Value, Dependency>(calculate:Void->Value, dependencies:DependencyList<Dependency>):Value;

	@:next.hook
	@:jsRequire("react", "useCallback")
	@:overload(function<Argument, Result, Dependency>(callback:Argument->Result, dependencies:DependencyList<Dependency>):Argument->Result {})
	@:overload(function<First, Second, Result, Dependency>(callback:(First, Second) -> Result,
		dependencies:DependencyList<Dependency>):(First, Second) -> Result {})
	static function useCallback<Result, Dependency>(callback:Void->Result, dependencies:DependencyList<Dependency>):Void->Result;

	@:next.hook
	@:jsRequire("react", "useOptimistic")
	static function useOptimistic<State, Action>(passthrough:State, reducer:(State, Action) -> State):Optimistic<State, Action>;
}
