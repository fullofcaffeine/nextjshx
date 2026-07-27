package dnd_kit;

import genes.react.Element;
import nextjs.integrations.dndkit.DndKit;
import nextjs.integrations.dndkit.ReorderResult;
import nextjs.raw.integrations.dndkit.DragDropProvider;
import nextjs.raw.integrations.dndkit.DragEndEvent;
import nextjs.raw.integrations.dndkit.Sortable;
import nextjs.raw.integrations.dndkit.Sortable.SortableElementRef;
import nextjs.raw.integrations.dndkit.Sortable.UseSortableResult;

typedef FixtureItem = {
	final id:String;
	final label:String;
}

/** Positive controls for the raw, semantic, HXX, and reorder contracts. */
@:keep
class Positive {
	static function main():Void {}

	@:next.hook
	public static function useSemantic(id:String, index:Int):UseSortableResult {
		return DndKit.useSortable(id, index);
	}

	@:next.hook
	public static function useRawNumeric(index:Int):UseSortableResult {
		return Sortable.useSortable({id: 42.0, index: index});
	}

	public static function render(ref:SortableElementRef, onDragEnd:DragEndEvent->Void):Element {
		return <DragDropProvider onDragEnd={onDragEnd}>
			<ol><li ref={ref}>Checked sortable row</li></ol>
		</DragDropProvider>;
	}

	public static function reordered(items:Array<FixtureItem>, event:DragEndEvent):Array<FixtureItem> {
		return switch DndKit.reorder(items, event, item -> item.id) {
			case Moved(next, _, _): next;
			case Unchanged(current, _): current;
			case Cancelled | MissingSource | MissingTarget | UnsupportedSourceId | UnsupportedTargetId | InvalidProjectedIndex(_) | SourceNotFound(_) |
				TargetNotFound(_): items;
		};
	}
}
