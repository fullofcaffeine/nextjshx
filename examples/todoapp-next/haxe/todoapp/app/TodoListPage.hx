package todoapp.app;

import genes.js.Async.await;
import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.cache.CacheFunction;
import nextjs.raw.Server;
import nextjs.raw.integrations.nuqs.NuqsAdapter;
import nextjs.raw.integrations.nuqs.QueryOptions.QueryHistory;
import nextjs.raw.metadata.Metadata;
import nextjs.raw.react.Suspense;
import nextjs.raw.react.Suspense.SuspenseProps;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;
import todoapp.cache.CachedTodos;
import todoapp.client.CreateTodoForm;
import todoapp.client.SortableTodoList;
import todoapp.persistence.TodoStore;

using nextjs.client.ClientComponent;

/** Server-rendered root ledger with typed links to every dynamic detail route. */
@:next.page("")
class TodoListPage {
	public static final metadata:Metadata = {
		title: "Open work — Field Ledger",
		description: "Deterministic server-rendered work, linked through generated typed route companions."
	};

	public static final segment = SegmentConfig.create({
		maxDuration: 5
	});

	public static function render(_props:PageProps<NoParams, SearchParams>):Element {
		final List = renderList;
		final fallback:Element = <main id="todo-list-loading" className="state-page" aria-busy={true} aria-live="polite">
			<p className="state-code">Opening the shared ledger</p>
			<div className="loading-rule"></div>
		</main>;
		final suspense:SuspenseProps = {fallback: fallback, name: "field-ledger-list"};
		return <Suspense {...suspense}><List /></Suspense>;
	}

	@:async
	static function renderList():Promise<Element> {
		await(Server.connection());
		final CreateForm = CreateTodoForm.client();
		final SortableList = SortableTodoList.client();
		final list = CacheFunction.ref(CachedTodos.list);
		final todos = await(list(TodoStore.cacheScope()));
		return <main id="todo-list-page" className="page">
			<section className="hero" aria-labelledby="ledger-title">
				<div>
					<p className="eyebrow">Production evidence / 001</p>
					<h1 id="ledger-title">Work worth shipping.</h1>
				</div>
				<p className="lede">A small, durable ledger proving Haxe-owned Server Components, deterministic file persistence, generated routes, and native Next metadata in one vertical slice.</p>
			</section>
			<section className="intake-section" aria-label="Create a field note">
				<CreateForm />
			</section>
			<section aria-label="Explore current field notes">
				<NuqsAdapter defaultOptions={{history: QueryHistory.Push}}>
					<SortableList todos={todos} />
				</NuqsAdapter>
			</section>
		</main>;
	}
}
