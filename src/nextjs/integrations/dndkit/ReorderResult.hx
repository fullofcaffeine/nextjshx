package nextjs.integrations.dndkit;

/**
 * Exhaustive result of interpreting a dnd-kit drag-end event.
 *
 * Callers must deliberately handle cancellation, incomplete operations,
 * unsupported host IDs, stale IDs, and a no-op drop instead of conflating all
 * of those states with a successful move.
 */
enum ReorderResult<Item> {
	Cancelled;
	MissingSource;
	MissingTarget;
	UnsupportedSourceId;
	UnsupportedTargetId;
	InvalidProjectedIndex(index:Int);
	SourceNotFound(id:String);
	TargetNotFound(id:String);
	Unchanged(items:Array<Item>, index:Int);
	Moved(items:Array<Item>, from:Int, to:Int);
}
