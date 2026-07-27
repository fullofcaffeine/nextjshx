package todoapp.domain;

/** Closed display and persistence vocabulary for the evidence app. */
enum abstract TodoPriority(String) {
	final Critical = "P0";
	final Important = "P1";
	final Routine = "P2";

	public static function parse(value:String):Null<TodoPriority> {
		return switch value {
			case "P0": Critical;
			case "P1": Important;
			case "P2": Routine;
			case _: null;
		};
	}

	/** Explicit host text projection; domain values do not widen implicitly. */
	public inline function value():String {
		return this;
	}
}
