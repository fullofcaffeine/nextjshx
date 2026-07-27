package todoapp.mutations;

/**
 * Validated replay identity injected by the client mutation adapter.
 *
 * This protects one operation from an ambiguous transport retry. It is not an
 * actor identity, capability, CSRF defense, or authorization decision.
 */
abstract TodoMutationId(String) to String {
	private inline function new(value:String) {
		this = value;
	}

	public static function parse(value:String):Null<TodoMutationId> {
		return ~/^[A-Za-z0-9:_-]{1,128}$/.match(value) ? new TodoMutationId(value) : null;
	}
}
