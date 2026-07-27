package todoapp.app;

import genes.react.Element;

/**
 * `@:next.loading("todos")` owns `app/todos/loading.tsx`. Next selects this
 * fallback during segment navigation/streaming; the Haxe layer only checks the
 * component and generated-file ownership.
 */
@:next.loading("todos")
class TodoLoading {
	public static function render():Element {
		return <main id="todo-loading" className="state-page" aria-busy={true} aria-live="polite">
			<p className="state-code">Consulting the field ledger</p>
			<div className="loading-rule"></div>
		</main>;
	}
}
