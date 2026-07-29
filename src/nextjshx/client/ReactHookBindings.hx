package nextjshx.client;

import nextjs.client.CachedPromise;
import nextjs.client.flight.v19.FlightPromise;
import nextjs.raw.react.Context;

/**
 * Internal exact bindings used after the semantic macros establish intent.
 * Application code should use `nextjs.client.React`.
 *
 * This remains an extern class because its static fields model named exports
 * from the host `react` module; unlike an implementation-only static shell,
 * that class shape is part of Haxe's exact JavaScript interop declaration.
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
}
