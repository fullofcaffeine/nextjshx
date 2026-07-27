package todoapp.client;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;
import nextjs.raw.integrations.nuqs.QueryOptions;
import nextjs.raw.integrations.nuqs.QueryOptions.QueryHistory;
import todoapp.domain.Todo;
import todoapp.domain.TodoPriority;

enum abstract TodoStatusFilter(String) to String {
	final All = "all";
	final Open = "open";
	final Done = "done";
}

enum abstract TodoPriorityFilter(String) to String {
	final All = "all";
	final Critical = "P0";
	final Important = "P1";
	final Routine = "P2";
}

enum abstract TodoView(String) to String {
	final List = "list";
	final Board = "board";
}

typedef TodoDiscoveryModel = {
	final status:TodoStatusFilter;
	final priority:TodoPriorityFilter;
	final view:TodoView;
	final search:String;
	final filtered:Bool;
	final selectStatus:TodoStatusFilter->Void;
	final selectPriority:TodoPriorityFilter->Void;
	final selectView:TodoView->Void;
	final setSearch:String->Void;
	final resetFilters:Void->Void;
}

typedef TodoProjection = {
	final visible:Array<Todo>;
	final total:Int;
	final open:Int;
	final done:Int;
}

/** Closed status lanes derived from one filtered, server-owned projection. */
typedef TodoBoardLanes = {
	final open:Array<Todo>;
	final completed:Array<Todo>;
}

/** URL-owned discovery intent plus pure projections over server-owned records. */
class TodoDiscovery {
	/**
	 * One reviewed Hook turns nuqs's four tuples into a closed application model.
	 * Invalid URL strings never enter the model: each literal parser resolves
	 * them to its declared default before this function receives the value.
	 */
	@:next.hook
	public static function useTodoDiscovery():TodoDiscoveryModel {
		final status = Nuqs.useQueryState("status",
			Parsers.stringLiteral([TodoStatusFilter.All, TodoStatusFilter.Open, TodoStatusFilter.Done], TodoStatusFilter.All));
		final priority = Nuqs.useQueryState("priority", Parsers.stringLiteral([
			TodoPriorityFilter.All,
			TodoPriorityFilter.Critical,
			TodoPriorityFilter.Important,
			TodoPriorityFilter.Routine
		], TodoPriorityFilter.All));
		final view = Nuqs.useQueryState("view", Parsers.stringLiteral([TodoView.List, TodoView.Board], TodoView.List));
		final search = Nuqs.useQueryState("search", Parsers.string(""));
		final replaceHistory:QueryOptions = {history: QueryHistory.Replace};
		final selectStatus = function(next:TodoStatusFilter):Void {
			status.set(next);
		};
		final selectPriority = function(next:TodoPriorityFilter):Void {
			priority.set(next);
		};
		final selectView = function(next:TodoView):Void {
			view.set(next);
		};
		final setSearch = function(next:String):Void {
			if (next.length == 0) {
				search.clearWithOptions(replaceHistory);
			} else {
				search.setWithOptions(next, replaceHistory);
			}
		};
		final resetFilters = function():Void {
			status.clear();
			priority.clear();
			view.clear();
			search.clear();
		};
		return {
			status: status.value,
			priority: priority.value,
			view: view.value,
			search: search.value,
			filtered: status.value != TodoStatusFilter.All
			|| priority.value != TodoPriorityFilter.All
			|| view.value != TodoView.List
			|| search.value.length > 0,
			selectStatus: selectStatus,
			selectPriority: selectPriority,
			selectView: selectView,
			setSearch: setSearch,
			resetFilters: resetFilters
		};
	}

	/** Preserves authored/server order while deriving a filter-only projection. */
	public static function project(orderedIds:Array<String>, todos:Array<Todo>, status:TodoStatusFilter, priority:TodoPriorityFilter,
			search:String):TodoProjection {
		final visible:Array<Todo> = [];
		var open = 0;
		for (todo in todos) {
			if (!todo.completed) {
				open++;
			}
		}
		final normalizedSearch = StringTools.trim(search).toLowerCase();
		for (id in orderedIds) {
			for (todo in todos) {
				if (todo.id == id && matches(todo, status, priority, normalizedSearch)) {
					visible.push(todo);
				}
			}
		}
		return {
			visible: visible,
			total: todos.length,
			open: open,
			done: todos.length - open
		};
	}

	/** Partitions visible records without copying them into synchronized state. */
	public static function boardLanes(visible:Array<Todo>):TodoBoardLanes {
		final open:Array<Todo> = [];
		final completed:Array<Todo> = [];
		for (todo in visible) {
			if (todo.completed) {
				completed.push(todo);
			} else {
				open.push(todo);
			}
		}
		return {open: open, completed: completed};
	}

	/**
	 * Reorders only the visible slots and leaves hidden records in their prior
	 * positions, so changing a filter never silently moves server-owned work.
	 */
	public static function mergeVisibleOrder(current:Array<String>, movedVisible:Array<String>):Array<String> {
		final merged:Array<String> = [];
		var visibleIndex = 0;
		for (id in current) {
			if (movedVisible.indexOf(id) == -1) {
				merged.push(id);
			} else {
				merged.push(movedVisible[visibleIndex]);
				visibleIndex++;
			}
		}
		return merged;
	}

	static function matches(todo:Todo, status:TodoStatusFilter, priority:TodoPriorityFilter, normalizedSearch:String):Bool {
		final statusMatches = switch status {
			case TodoStatusFilter.All: true;
			case TodoStatusFilter.Open: !todo.completed;
			case TodoStatusFilter.Done: todo.completed;
		};
		final priorityMatches = switch priority {
			case TodoPriorityFilter.All: true;
			case TodoPriorityFilter.Critical: todo.priority == TodoPriority.Critical;
			case TodoPriorityFilter.Important: todo.priority == TodoPriority.Important;
			case TodoPriorityFilter.Routine: todo.priority == TodoPriority.Routine;
		};
		final searchMatches = normalizedSearch.length == 0
			|| todo.title.toLowerCase().indexOf(normalizedSearch) != -1
			|| todo.note.toLowerCase().indexOf(normalizedSearch) != -1;
		return statusMatches && priorityMatches && searchMatches;
	}
}
