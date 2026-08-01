package todoapp.app;

import genes.react.Element;
import nextjs.raw.components.Link;

/**
 * `@:next.notFound("todos")` owns the segment's `not-found.tsx`. The detail
 * page calls Next's native `notFound()` interruption; Next keeps responsibility
 * for the 404 status, routing, streaming, and indexing behavior. The Haxe
 * source stays a normal module function just like an idiomatic TSX component.
 */
@:next.notFound("todos")
function render():Element {
	return <main id="todo-not-found" className="state-page">
		<p className="state-code">404 / unfiled</p>
		<h2>No note lives here.</h2>
		<p>The requested record is absent from the deterministic ledger. Next.js still owns routing, streaming status, and search-index behavior.</p>
		<Link className="back-link" href={TodoListPage.href()}>← Review active field notes</Link>
	</main>;
}
