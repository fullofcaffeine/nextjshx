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

/** Haxe-authored tide state with bounded updates and explicit direction. */
class TideHook {
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
