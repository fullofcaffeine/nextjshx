package dnd_kit;

import nextjs.integrations.dndkit.DndKit;

/** Sortable indices remain compile-time integers. */
class WrongIndex {
	@:next.hook
	public static function useInvalid(id:String):Void {
		DndKit.useSortable(id, "first");
	}
}
