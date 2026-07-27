package todoapp.domain;

/** URL-safe identity parsed once at the persistence boundary. */
abstract TodoId(String) to String {
	private inline function new(value:String) {
		this = value;
	}

	public static function parse(value:String):Null<TodoId> {
		if (!~/^[a-z0-9]+(?:-[a-z0-9]+)*$/.match(value) || value.length > 64) {
			return null;
		}
		return new TodoId(value);
	}
}
