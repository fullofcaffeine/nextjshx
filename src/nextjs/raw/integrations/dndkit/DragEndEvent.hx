package nextjs.raw.integrations.dndkit;

/** Reviewed entity slice exposed by a completed drag operation. */
typedef DragEntity = {
	final id:DndIdentifier;

	/** Sortable entities expose their registration-time position. */
	@:ts.optional
	final ?initialIndex:Int;

	/** Optimistic pointer/keyboard sorting projects the current destination. */
	@:ts.optional
	final ?index:Int;
}

/** Reviewed source and target slice exposed by dnd-kit's drag snapshot. */
typedef DragOperation = {
	final source:Null<DragEntity>;
	final target:Null<DragEntity>;
}

/** Faithful closed slice needed to interpret a dnd-kit drag-end event. */
typedef DragEndEvent = {
	final canceled:Bool;
	final operation:DragOperation;
}
