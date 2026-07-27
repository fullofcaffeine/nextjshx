package todoapp.app;

import genes.react.Element;
import nextjs.raw.components.Link;

/** Segment-owned 404 selected by Next after the detail page interrupts control flow. */
@:next.notFound("todos")
class TodoNotFound {
	public static function render():Element {
		return <main id="todo-not-found" className="state-page">
			<p className="state-code">404 / unfiled</p>
			<h2>No note lives here.</h2>
			<p>The requested record is absent from the deterministic ledger. Next.js still owns routing, streaming status, and search-index behavior.</p>
			<Link className="back-link" href={TodoListPage.href()}>← Review active field notes</Link>
		</main>;
	}
}
