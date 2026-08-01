package nextjs.integrations.dndkit;

import nextjs.integrations.dndkit.ReorderResult;
import nextjs.raw.integrations.dndkit.ArrayMove;
import nextjs.raw.integrations.dndkit.DndIdentifier;
import nextjs.raw.integrations.dndkit.DragEndEvent;
import nextjs.raw.integrations.dndkit.Sortable.UseSortableResult;
import nextjshx.integrations.dndkit.DndKitHookBindings;

using genes.js.ArrayCallbacks;

/** Intent-oriented dnd-kit surface for Haxe-authored sortable interfaces. */
class DndKit {
	/**
	 * Makes one item sortable with a domain string ID and its current index.
	 *
	 * This custom Hook erases to the direct package call. dnd-kit's default
	 * pointer, keyboard, sorting, and accessibility plugins remain in control.
	 */
	@:next.hook
	public static inline function useSortable(id:String, index:Int):UseSortableResult {
		return DndKitHookBindings.useSortable({id: id, index: index});
	}

	/** Interprets a drag-end event and immutably reorders a closed item array. */
	public static function reorder<Item>(items:Array<Item>, event:DragEndEvent, idOf:Item->String):ReorderResult<Item> {
		if (event.canceled) {
			return Cancelled;
		}
		final source = event.operation.source;
		if (source == null) {
			return MissingSource;
		}
		final target = event.operation.target;
		if (target == null) {
			return MissingTarget;
		}
		final sourceId = stringId(source.id);
		if (sourceId == null) {
			return UnsupportedSourceId;
		}
		final targetId = stringId(target.id);
		if (targetId == null) {
			return UnsupportedTargetId;
		}
		final from = findIndex(items, sourceId, idOf);
		if (from == -1) {
			return SourceNotFound(sourceId);
		}
		final targetIndex = findIndex(items, targetId, idOf);
		return switch source.index {
			case null:
				moveTo(items, from, targetIndex, targetId);
			case projected if (!isValidIndex(projected, items.length)):
				InvalidProjectedIndex(projected);
			case projected:
				moveTo(items, from, projected != from ? projected : targetIndex, targetId);
		};
	}

	static function isValidIndex(index:Int, length:Int):Bool {
		return index >= 0 && index < length;
	}

	static function moveTo<Item>(items:Array<Item>, from:Int, to:Int, targetId:String):ReorderResult<Item> {
		if (to == -1) {
			return TargetNotFound(targetId);
		}
		if (from == to) {
			return Unchanged(items, from);
		}
		return Moved(ArrayMove.move(items, from, to), from, to);
	}

	static function findIndex<Item>(items:Array<Item>, id:String, idOf:Item->String):Int {
		// Genes exposes Haxe 4.3's missing findIndex as a typed, zero-wrapper
		// native Array operation. The generated semantic module therefore stays
		// close to idiomatic TypeScript without an indexed generic assertion.
		return items.findIndex(item -> idOf(item) == id);
	}

	static function stringId(id:DndIdentifier):Null<String> {
		// External boundary: dnd-kit deliberately permits string | number IDs.
		// Validate the runtime arm before converting it to the closed semantic ID.
		if (!Std.isOfType(id, String)) {
			return null;
		}
		return id;
	}
}
