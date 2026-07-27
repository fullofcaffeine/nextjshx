package todoapp.app;

import genes.react.Element;

/** Segment-owned loading UI retained for later streamed and browser evidence. */
@:next.loading("todos")
class TodoLoading {
	public static function render():Element {
		return <main id="todo-loading" className="state-page" aria-busy={true} aria-live="polite">
			<p className="state-code">Consulting the field ledger</p>
			<div className="loading-rule"></div>
		</main>;
	}
}
