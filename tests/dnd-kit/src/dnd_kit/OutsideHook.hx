package dnd_kit;

import nextjs.integrations.dndkit.DndKit;

/** The semantic facade retains reviewed React Hook identity. */
class OutsideHook {
	public static function invalid(id:String, index:Int):Void {
		DndKit.useSortable(id, index);
	}
}
