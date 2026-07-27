package nextjs.raw.integrations.dndkit;

import js.html.Element as BrowserElement;

/** Closed reviewed subset of dnd-kit's sortable Hook input. */
typedef UseSortableInput = {
	final id:DndIdentifier;
	final index:Int;
	@:ts.optional
	final ?disabled:Bool;
	@:ts.optional
	final ?group:DndIdentifier;
}

/** Callback ref accepted by browser elements. */
typedef SortableElementRef = Null<BrowserElement>->Void;

/** Closed reviewed result of dnd-kit's sortable Hook. */
typedef UseSortableResult = {
	final isDragging:Bool;
	final isDropping:Bool;
	final isDragSource:Bool;
	final isDropTarget:Bool;
	final handleRef:SortableElementRef;
	final ref:SortableElementRef;
	final sourceRef:SortableElementRef;
	final targetRef:SortableElementRef;
}

/** Faithful raw binding to dnd-kit's current sortable Hook. */
extern class Sortable {
	@:next.hook
	@:jsRequire("@dnd-kit/react/sortable", "useSortable")
	static function useSortable(input:UseSortableInput):UseSortableResult;
}
