package todoapp.client;

import genes.react.Element;
import genes.react.React.useState;
import genes.react.React.useOptimistic;
import nextjs.integrations.dndkit.DndKit;
import nextjs.integrations.recharts.StackedBars;
import nextjs.raw.Navigation;
import nextjs.raw.integrations.recharts.Bar;
import nextjs.raw.integrations.recharts.BarChart;
import nextjs.raw.integrations.recharts.CartesianGrid;
import nextjs.raw.integrations.recharts.ChartTypes.AxisType;
import nextjs.raw.integrations.recharts.ChartTypes.BarChartLayout;
import nextjs.raw.integrations.recharts.ChartTypes.ChartMargin;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarCategoryKey;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarDatum;
import nextjs.raw.integrations.dndkit.DragDropProvider;
import nextjs.raw.integrations.dndkit.DragEndEvent;
import nextjs.raw.integrations.recharts.XAxis;
import nextjs.raw.integrations.recharts.YAxis;
import nextjs.raw.server.WebFormData;
import showcase.ui.Button.ButtonSize;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.UiButton;
import showcase.ui.Input.InputType;
import showcase.ui.Input.UiInput;
import todoapp.actions.TodoActions;
import todoapp.client.TodoDiscovery.TodoPriorityFilter;
import todoapp.client.TodoDiscovery.TodoStatusFilter;
import todoapp.client.TodoDiscovery.TodoView;
import todoapp.client.TodoCommandCenter.render as renderCommandCenter;
import todoapp.client.TodoPlanning.project;
import todoapp.domain.Todo;
import todoapp.input.TodoInputCodecs.orderMutationForm;
import todoapp.mutations.TodoMutationState.TodoMutationOperation;
import todoapp.mutations.TodoMutationState.TodoMutationPhase;
import nextjs.codec.DecodeResult;
import nextjs.server.ServerFunction;

using nextjs.client.ClientComponent;

typedef SortableTodoListProps = {
	final todos:Array<Todo>;
}

/**
 * Hydrated sortable-list boundary with explicit drag-end outcomes.
 *
 * Optimistic state projects only order, while current server props remain the
 * source of todo content. New records append and removed records disappear
 * without an Effect or a second copy of server-owned data.
 */
@:next.clientComponent
class SortableTodoList {
	/**
	 * Composes URL-owned discovery, optimistic ordering, charts, and list/board
	 * presentations inside one hydrated boundary.
	 *
	 * dnd-kit, nuqs, Recharts, and React retain their native runtimes. Haxe
	 * keeps route/filter/priority/order/action values closed and ensures both
	 * views project one server-owned collection rather than synchronized stores.
	 */
	public static function render(props:SortableTodoListProps):Element {
		final order = useOptimistic(todoIds(props.todos), (_current:Array<String>, next:Array<String>) -> next);
		final mutation = MutationHook.useTodoMutation(ServerFunction.ref(TodoActions.reorder), TodoMutationOperation.Reorder,
			"Drag a handle or focus it and press Space to reorder.", formData -> switch orderMutationForm(formData) {
				case Decoded(input): order.apply(input.payload.map(id -> (id : String)));
				case Rejected(_): {}
			});
		final announcement = useState("Drag a handle or focus it and press Space to reorder.");
		final discovery = TodoDiscovery.useTodoDiscovery();
		final commandOpen = useState(false);
		final router = Navigation.useRouter();
		final currentIds = mergeCurrentIds(order.value, props.todos);
		final projection = TodoDiscovery.project(currentIds, props.todos, discovery.status, discovery.priority, discovery.search);
		final planning = project(projection.visible);
		final chart = StackedBars.create(planning.rows, "Open", "var(--planning-open)", "Filed", "var(--planning-filed)");
		final chartMargin:ChartMargin = {
			top: 8,
			right: 8,
			bottom: 8,
			left: 0
		};
		final planningRows:Array<Element> = [];
		for (row in planning.rows) {
			planningRows.push(planningRow(row));
		}
		final contentFiltered = discovery.status != TodoStatusFilter.All
			|| discovery.priority != TodoPriorityFilter.All
			|| StringTools.trim(discovery.search).length > 0;
		final planningScope = contentFiltered ? "Current lens" : "All work";
		final planningMessage = planning.total == 0 ? "No field notes are visible in this lens." : planning.urgentOpen == 0 ? "No urgent P0 work remains in this lens." : planning.urgentOpen == 1 ? "1 urgent P0 field note remains." : planning.urgentOpen
			+ " urgent P0 field notes remain.";
		final visibleIds = todoIds(projection.visible);
		final Row = SortableTodoRow.client();

		final reorder = (scopeIds:Array<String>, event:DragEndEvent) -> {
			if (mutation.pending) {
				announcement.set("Finish the current ledger save before reordering again.");
				return;
			}
			if (!mutation.online) {
				announcement.set("Offline. Reconnect before changing the shared ledger order.");
				return;
			}
			if (mutation.state.retryable) {
				announcement.set("Retry the unconfirmed order before starting another reorder.");
				return;
			}
			switch DndKit.reorder(scopeIds, event, id -> id) {
				case Moved(next, from, to):
					final nextOrder = TodoDiscovery.mergeVisibleOrder(currentIds, next);
					final formData = new WebFormData();
					for (id in nextOrder) {
						formData.append("id", id);
					}
					mutation.submit(formData);
					announcement.set('Moved field note ${from + 1} to position ${to + 1}; saving optimistically.');
				case Unchanged(_, index):
					announcement.set('Field note ${index + 1} stayed in place.');
				case Cancelled:
					announcement.set("Reordering cancelled.");
				case MissingSource:
					announcement.set("Reordering ended without a source item.");
				case MissingTarget:
					announcement.set("Reordering ended outside the list.");
				case UnsupportedSourceId | UnsupportedTargetId:
					announcement.set("Reordering rejected an unsupported package ID.");
				case InvalidProjectedIndex(index):
					announcement.set('Reordering rejected invalid package position $index.');
				case SourceNotFound(id) | TargetNotFound(id):
					announcement.set('Reordering ignored stale field note $id.');
			}
		};
		final statusButtons = [
			choice("All work", discovery.status == TodoStatusFilter.All, () -> discovery.selectStatus(TodoStatusFilter.All)),
			choice("Open", discovery.status == TodoStatusFilter.Open, () -> discovery.selectStatus(TodoStatusFilter.Open)),
			choice("Complete", discovery.status == TodoStatusFilter.Done, () -> discovery.selectStatus(TodoStatusFilter.Done))
		];
		final priorityButtons = [
			choice("All levels", discovery.priority == TodoPriorityFilter.All, () -> discovery.selectPriority(TodoPriorityFilter.All)),
			choice("P0", discovery.priority == TodoPriorityFilter.Critical, () -> discovery.selectPriority(TodoPriorityFilter.Critical)),
			choice("P1", discovery.priority == TodoPriorityFilter.Important, () -> discovery.selectPriority(TodoPriorityFilter.Important)),
			choice("P2", discovery.priority == TodoPriorityFilter.Routine, () -> discovery.selectPriority(TodoPriorityFilter.Routine))
		];
		final viewButtons = [
			choice("List", discovery.view == TodoView.List, () -> discovery.selectView(TodoView.List)),
			choice("Board", discovery.view == TodoView.Board, () -> discovery.selectView(TodoView.Board))
		];
		final resultLabel = projection.visible.length + " shown / " + projection.open + " open / " + projection.total + " total";
		final workbenchClass = discovery.view == TodoView.Board ? "workbench is-board" : "workbench is-list";
		final reorderFailed = mutation.state.phase == TodoMutationPhase.Rejected
			|| mutation.state.phase == TodoMutationPhase.TransportFailure;
		final reorderMessage = !mutation.online ? "Offline. Reconnect to retry a saved order." : mutation.pending ? announcement.value : mutation.state.phase == TodoMutationPhase.Ready ? announcement.value : mutation.state.message;
		final viewValue = discovery.view;
		final reorderPending = mutation.pending;
		final workbenchClassName = workbenchClass;
		var workspace:Element;
		if (discovery.view == TodoView.Board) {
			final lanes = TodoDiscovery.boardLanes(projection.visible);
			final openIds = todoIds(lanes.open);
			final completedIds = todoIds(lanes.completed);
			final openRows:Array<Element> = [];
			final completedRows:Array<Element> = [];
			for (index in 0...lanes.open.length) {
				final todo = lanes.open[index];
				openRows.push(<Row key={todo.id} todo={todo} index={index} />);
			}
			for (index in 0...lanes.completed.length) {
				final todo = lanes.completed[index];
				completedRows.push(<Row key={todo.id} todo={todo} index={index} />);
			}
			final openLane:Element = openRows.length == 0 ? <div className="board-lane-empty" role="status">
				<p>No open notes in this lens.</p>
				<span>Change a filter or capture new work above.</span>
			</div> : <ol className="todo-list board-list" aria-label="Open field notes" data-sortable-list="open-field-notes">{openRows}</ol>;
			final completedLane:Element = completedRows.length == 0 ? <div className="board-lane-empty" role="status">
				<p>Nothing is filed in this lens.</p>
				<span>Complete a note to move it into the archive.</span>
			</div> : <ol className="todo-list board-list" aria-label="Completed field notes" data-sortable-list="completed-field-notes">{completedRows}</ol>;
			workspace = <div className="board-grid" role="group" aria-label="Todo status board">
				<section className="board-lane board-lane-open" data-board-lane="open" aria-labelledby="board-open-title">
					<header className="board-lane-head">
						<div><p className="board-lane-code">Active register</p><h3 id="board-open-title">Open work</h3></div>
						<p className="board-lane-count"><strong>{"" + lanes.open.length}</strong><span>visible</span></p>
					</header>
					<DragDropProvider onDragEnd={event -> reorder(openIds, event)}>{openLane}</DragDropProvider>
				</section>
				<section className="board-lane board-lane-completed" data-board-lane="completed" aria-labelledby="board-completed-title">
					<header className="board-lane-head">
						<div><p className="board-lane-code">Filed archive</p><h3 id="board-completed-title">Complete</h3></div>
						<p className="board-lane-count"><strong>{"" + lanes.completed.length}</strong><span>visible</span></p>
					</header>
					<DragDropProvider onDragEnd={event -> reorder(completedIds, event)}>{completedLane}</DragDropProvider>
				</section>
			</div>;
		} else {
			final rows:Array<Element> = [];
			for (index in 0...projection.visible.length) {
				final todo = projection.visible[index];
				rows.push(<Row key={todo.id} todo={todo} index={index} />);
			}
			final ledger:Element = rows.length == 0 ? <div className="empty-ledger" role="status">
				<p className="eyebrow">Nothing in this lens</p>
				<h3>{projection.total == 0 ? "The field desk is clear." : "No notes match these coordinates."}</h3>
				<p>{projection.total == 0 ? "File the first piece of work above." : "Reset the URL-backed filters, or leave this exact view ready to share."}</p>
				<UiButton type={ButtonType.Button} variant={ButtonVariant.Outline} disabled={!discovery.filtered} onClick={_ -> discovery.resetFilters()}>Reset the lens</UiButton>
			</div> : <ol className="todo-list" data-sortable-list="field-notes">{rows}</ol>;
			workspace = <DragDropProvider onDragEnd={event -> reorder(visibleIds, event)}>{ledger}</DragDropProvider>;
		}

		return <div className="todo-workbench">
			{renderCommandCenter({
				open: commandOpen.value,
				setOpen: next -> commandOpen.set(next),
				discovery: discovery,
				visibleTodos: projection.visible,
				router: router
			})}
			<section className="discovery-panel" aria-labelledby="discovery-title">
				<div className="discovery-intro">
					<div><p className="eyebrow">Live field lens / URL-owned</p><h2 id="discovery-title">Find the next useful move.</h2></div>
					<p>Every control is shareable. Status and view changes join browser history; search edits refine the current entry.</p>
				</div>
				<div className="discovery-grid">
					<div className="discovery-search">
						<label htmlFor="todo-search">Search title or note</label>
						<UiInput id="todo-search" type={InputType.Search} value={discovery.search} placeholder="Try “production”" autoComplete="off" maxLength={80} className="ledger-input discovery-input" onChange={event -> discovery.setSearch(event.currentTarget.value)} />
					</div>
					<fieldset className="lens-group"><legend>Status</legend><div>{statusButtons}</div></fieldset>
					<fieldset className="lens-group"><legend>Priority</legend><div>{priorityButtons}</div></fieldset>
					<fieldset className="lens-group lens-view"><legend>View</legend><div>{viewButtons}</div></fieldset>
				</div>
				<div className="discovery-foot">
					<p id="todo-count" aria-live="polite">{resultLabel}</p>
					<UiButton type={ButtonType.Button} variant={ButtonVariant.Outline} size={ButtonSize.Small} disabled={!discovery.filtered} className="reset-lens" onClick={_ -> discovery.resetFilters()}>Reset lens</UiButton>
				</div>
			</section>
			<section className="planning-insight" aria-labelledby="planning-title" data-planning-scope={contentFiltered ? "filtered" : "all"}>
				<div className="planning-copy">
					<div><p className="eyebrow">Priority runway / {planningScope}</p><h2 id="planning-title">See where the work is sitting.</h2></div>
					<p>Open and filed notes share one typed projection, so the chart, summary, and table cannot disagree about the current lens.</p>
				</div>
				<div className="planning-summary" aria-live="polite">
					<p><strong data-planning-open>{"" + planning.open}</strong><span>Open</span></p>
					<p><strong data-planning-completed>{"" + planning.completed}</strong><span>Filed</span></p>
					<p><strong data-planning-percent>{planning.completionPercent + "%"}</strong><span>Complete</span></p>
					<p className={planning.urgentOpen > 0 ? "planning-urgent is-active" : "planning-urgent"}>{planningMessage}</p>
				</div>
				<div className="planning-visual">
					<div className="planning-plot">
						<div className="planning-legend" aria-hidden="true"><span className="is-open">Open</span><span className="is-filed">Filed</span></div>
						<BarChart data={chart.rows} responsive={true} accessibilityLayer={true} layout={BarChartLayout.Vertical} className="planning-chart" desc="Open and completed field notes grouped by P0, P1, and P2 priority." margin={chartMargin} tabIndex={0}>
							<CartesianGrid horizontal={false} vertical={true} stroke="var(--planning-grid)" strokeDasharray="2 4" />
							<XAxis type={AxisType.Number} allowDecimals={false} axisLine={false} tickLine={false} tickCount={2} />
							<YAxis type={AxisType.Category} dataKey={StackedBarCategoryKey.Category} axisLine={false} tickLine={false} width={34} />
							<Bar dataKey={chart.primary.key} name={chart.primary.label} fill={chart.primary.color} stackId="work" barSize={18} isAnimationActive={false} />
							<Bar dataKey={chart.secondary.key} name={chart.secondary.label} fill={chart.secondary.color} stackId="work" barSize={18} isAnimationActive={false} />
						</BarChart>
					</div>
					<div className="planning-table-wrap">
						<table className="planning-table">
							<caption>Planning values for {planningScope.toLowerCase()}; the same values are drawn in the chart.</caption>
							<thead><tr><th scope="col">Priority</th><th scope="col">Open</th><th scope="col">Filed</th><th scope="col">Total</th></tr></thead>
							<tbody>{planningRows}</tbody>
						</table>
					</div>
				</div>
			</section>
			<div className="ledger-head"><span id="work-index">Current field notes</span><span>{discovery.view == TodoView.Board ? "Status register" : "Ordered ledger"}</span></div>
			<div className={workbenchClassName} data-view={viewValue} aria-busy={reorderPending}>
				{workspace}
				<div className="reorder-feedback">
					<p id="reorder-status" className={reorderFailed ? "reorder-status is-error" : "reorder-status"} data-phase={mutation.state.phase} aria-live="polite">{reorderMessage}</p>
					<button type="button" className="mutation-retry" hidden={!mutation.state.retryable} disabled={!mutation.canRetry} onClick={_ -> mutation.retry()}>Retry saved order</button>
				</div>
			</div>
		</div>;
	}

	static function planningRow(row:StackedBarDatum):Element {
		return <tr data-planning-priority={row.category}>
			<th scope="row">{row.category}</th>
			<td>{"" + row.primary}</td>
			<td>{"" + row.secondary}</td>
			<td>{"" + (row.primary + row.secondary)}</td>
		</tr>;
	}

	static function choice(label:String, active:Bool, select:Void->Void):Element {
		return <UiButton
			type={ButtonType.Button}
			variant={active ? ButtonVariant.Default : ButtonVariant.Ghost}
			size={ButtonSize.Small}
			className="lens-option"
			ariaPressed={active}
			onClick={_ -> select()}
		>{label}</UiButton>;
	}

	static function todoIds(todos:Array<Todo>):Array<String> {
		final ids:Array<String> = [];
		for (todo in todos) {
			ids.push(todo.id);
		}
		return ids;
	}

	static function mergeCurrentIds(order:Array<String>, todos:Array<Todo>):Array<String> {
		final ids:Array<String> = [];
		for (id in order) {
			if (containsTodo(todos, id)) {
				ids.push(id);
			}
		}
		for (todo in todos) {
			final id:String = todo.id;
			if (ids.indexOf(id) == -1) {
				ids.push(id);
			}
		}
		return ids;
	}

	static function containsTodo(todos:Array<Todo>, id:String):Bool {
		for (todo in todos) {
			if (todo.id == id) {
				return true;
			}
		}
		return false;
	}
}
