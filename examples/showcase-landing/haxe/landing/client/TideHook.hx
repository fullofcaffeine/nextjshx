package landing.client;

import nextjs.client.React;

enum abstract TideDirection(String) to String {
	final Rising = "rising";
	final Falling = "falling";
}

typedef TideReading = {
	final level:Int;
	final direction:TideDirection;
	final raise:Void->Void;
	final lower:Void->Void;
}

/**
 * Temporary static shell for the tide dial's bounded client Hook.
 *
 * The Hook has no class identity and should ultimately be a module function.
 * The current NextJsHx analyzer-function bridge still requires a public static
 * field so it can lift the checked body into a native module-level Hook. The
 * reusable module-Hook capability is being generalized in `genes.react`; this
 * class should disappear when NextJsHx consumes that public surface.
 */
class TideHook {
	/**
	 * `@:next.hook` gives this function a typed React Hook identity and
	 * enforces top-level placement. `React.useState` returns the semantic
	 * zero-wrapper `State<T>` view: `.value` reads, `.set` replaces, and
	 * `.update` computes from the previous value.
	 */
	@:next.hook
	public static function useTideReading(initialLevel:Int):TideReading {
		final level = React.useState(initialLevel);
		final direction = React.useState(TideDirection.Rising);
		return {
			level: level.value,
			direction: direction.value,
			raise: () -> {
				direction.set(TideDirection.Rising);
				level.update(current -> current + 4 > 94 ? 94 : current + 4);
			},
			lower: () -> {
				direction.set(TideDirection.Falling);
				level.update(current -> current - 4 < 10 ? 10 : current - 4);
			}
		};
	}
}
