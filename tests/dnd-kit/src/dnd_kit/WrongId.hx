package dnd_kit;

import nextjs.integrations.dndkit.DndKit;

/** Semantic sortable IDs are strings, not dnd-kit's broader host union. */
class WrongId {
	@:next.hook
	public static function useInvalid(index:Int):Void {
		DndKit.useSortable(42, index);
	}
}
