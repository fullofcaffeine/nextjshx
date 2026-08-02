package todoapp.app;

import genes.react.Element;

/**
 * `@:next.loading("todos")` owns `app/todos/loading.tsx`. Next selects this
 * fallback during segment navigation/streaming; the Haxe layer only checks the
 * component and generated-file ownership. A module function is enough because
 * this fallback has no runtime class identity.
 */
@:next.loading("todos")
function render():Element {
	return <main id="todo-loading" className="state-page" aria-busy={true} aria-live="polite">
		<p className="state-code">Consulting the field ledger</p>
		<div className="loading-rule"></div>
	</main>;
}
