package todoapp.client;

import nextjs.integrations.recharts.StackedBars;
import nextjs.raw.integrations.recharts.ChartTypes.StackedBarDatum;
import todoapp.domain.Todo;
import todoapp.domain.TodoPriority;

/** Closed planning totals derived from the currently visible Todo records. */
typedef TodoPlanningSnapshot = {
	final total:Int;
	final open:Int;
	final completed:Int;
	final completionPercent:Int;
	final urgentOpen:Int;
	final rows:Array<StackedBarDatum>;
}

/** Pure Todo-to-chart projection; it owns no React state and no chart runtime. */
class TodoPlanning {
	public static function project(todos:Array<Todo>):TodoPlanningSnapshot {
		var p0Open = 0;
		var p0Completed = 0;
		var p1Open = 0;
		var p1Completed = 0;
		var p2Open = 0;
		var p2Completed = 0;

		for (todo in todos) {
			switch todo.priority {
				case TodoPriority.Critical:
					if (todo.completed) {
						p0Completed++;
					} else {
						p0Open++;
					}
				case TodoPriority.Important:
					if (todo.completed) {
						p1Completed++;
					} else {
						p1Open++;
					}
				case TodoPriority.Routine:
					if (todo.completed) {
						p2Completed++;
					} else {
						p2Open++;
					}
			}
		}

		final completed = p0Completed + p1Completed + p2Completed;
		final open = p0Open + p1Open + p2Open;
		final total = open + completed;
		return {
			total: total,
			open: open,
			completed: completed,
			completionPercent: total == 0 ? 0 : Math.round(completed / total * 100),
			urgentOpen: p0Open,
			rows: [
				StackedBars.row("P0", p0Open, p0Completed),
				StackedBars.row("P1", p1Open, p1Completed),
				StackedBars.row("P2", p2Open, p2Completed)
			]
		};
	}
}
