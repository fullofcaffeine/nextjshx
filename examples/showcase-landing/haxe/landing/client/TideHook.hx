package landing.client;

import genes.react.React.useState;

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
 * The Hook has no application-level class identity and should ultimately be a
 * module function. The current NextJsHx `@:next.hook` owner contract still
 * requires one public static field. Generic state, Hook typing, and
 * analyzer-visible module-function lowering already come from `genes.react`;
 * removing the remaining Next owner shell is tracked as a separate API
 * migration.
 */
class TideHook {
	/**
	 * `@:next.hook` gives this function a typed React Hook identity and
	 * enforces top-level placement. `useState` returns the semantic
	 * zero-wrapper `State<T>` view: `.value` reads, `.set` replaces, and
	 * `.update` computes from the previous value.
	 */
	@:next.hook
	public static function useTideReading(initialLevel:Int):TideReading {
		final level = useState(initialLevel);
		final direction = useState(TideDirection.Rising);
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
