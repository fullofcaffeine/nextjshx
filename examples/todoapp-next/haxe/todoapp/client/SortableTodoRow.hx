package todoapp.client;

import genes.react.Element;
import nextjs.integrations.dndkit.DndKit;
import nextjs.raw.components.Link;
import nextjs.raw.integrations.dndkit.Sortable.SortableElementRef;
import todoapp.app.TodoDetailPage;
import todoapp.domain.Todo;

using nextjs.client.ClientComponent;

typedef SortableTodoRowProps = {
	final todo:Todo;
	final index:Int;
}

private typedef SortableRowElementProps = {
	final ref:SortableElementRef;
	final className:String;
}

/** One top-level sortable Hook and its checked row/handle refs. */
@:next.clientComponent
class SortableTodoRow {
	/**
	 * Connects one closed Todo record to dnd-kit's sortable row contract.
	 *
	 * The native package owns transforms, listeners, and keyboard/pointer
	 * behavior. Haxe checks row props and reuses the existing mutation boundary
	 * without duplicating record state.
	 */
	public static function render(props:SortableTodoRowProps):Element {
		final sortable = DndKit.useSortable(props.todo.id, props.index);
		final RowActions = TodoRowActions.client();
		var stateClass = props.todo.completed ? "todo-row is-done" : "todo-row";
		if (sortable.isDragging) {
			stateClass += " is-dragging";
		} else if (sortable.isDropTarget) {
			stateClass += " is-drop-target";
		}
		final stateLabel = props.todo.completed ? "Complete" : "Open";
		final number = props.index + 1;
		final sequence = number < 10 ? "0" + number : "" + number;
		final rowProps:SortableRowElementProps = {ref: sortable.ref, className: stateClass};
		return <li {...rowProps} data-sortable-item="true">
			<button
				ref={sortable.handleRef}
				type="button"
				className="drag-handle"
				aria-label={"Reorder " + props.todo.title}
			>
				<span aria-hidden="true">↕</span>
			</button>
			<span className="sequence">{sequence}</span>
			<div>
				<Link className="todo-link" href={TodoDetailPage.href({id: props.todo.id})} prefetch={false}>{props.todo.title}</Link>
				<p className="todo-note">{props.todo.note}</p>
			</div>
			<span className="stamp" aria-label={stateLabel}>{props.todo.priority.value()}</span>
			<RowActions id={props.todo.id} completed={props.todo.completed} title={props.todo.title} />
		</li>;
	}
}
