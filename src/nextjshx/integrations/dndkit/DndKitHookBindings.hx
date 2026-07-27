package nextjshx.integrations.dndkit;

import nextjs.raw.integrations.dndkit.Sortable.UseSortableResult;

/** Internal string-ID input used after the semantic API narrows dnd-kit. */
typedef SemanticSortableInput = {
	final id:String;
	final index:Int;
}

/** Internal direct package binding used by the allocation-free semantic Hook. */
@:noCompletion
extern class DndKitHookBindings {
	@:next.hook
	@:jsRequire("@dnd-kit/react/sortable", "useSortable")
	static function useSortable(input:SemanticSortableInput):UseSortableResult;
}
