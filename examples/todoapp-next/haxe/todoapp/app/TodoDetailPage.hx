package todoapp.app;

import genes.js.Async.await;
import genes.react.Element;
import js.lib.Error;
import js.lib.Promise;
import nextjs.app.PageMetadataProps;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.raw.Navigation;
import nextjs.raw.Server;
import nextjs.raw.components.Link;
import nextjs.raw.metadata.Metadata;
import nextjs.raw.metadata.ResolvingMetadata;
import nextjs.route.SearchParams;
import todoapp.client.FailureRecoveryProbe;
import todoapp.domain.Todo;
import todoapp.domain.TodoId;
import todoapp.persistence.TodoStore;

using nextjs.client.ClientComponent;

import todoapp.persistence.TodoRuntime;

typedef TodoDetailParams = {
	final id:TodoId;
}

/** Parametric server page with exact route params, generated metadata, and 404 flow. */
@:next.page("todos/[id]")
class TodoDetailPage {
	public static final segment = SegmentConfig.create({
		maxDuration: 5
	});

	public static function generateStaticParams():Array<TodoDetailParams> {
		return TodoStore.list().map(todo -> {id: todo.id});
	}

	@:async
	public static function generateMetadata(props:PageMetadataProps<TodoDetailParams, SearchParams>, _parent:ResolvingMetadata):Promise<Metadata> {
		await(Server.connection());
		final params = await(props.params);
		final todo = TodoStore.find(params.id);
		final value:Metadata = todo == null ? {
			title: "Missing field note — Field Ledger"
		} : {
			title: todo.title + " — Field Ledger",
			description: todo.note
			};
		return value;
	}

	@:async
	public static function render(props:PageProps<TodoDetailParams, SearchParams>):Promise<Element> {
		await(Server.connection());
		await(TodoRuntime.waitForDetail());
		final params = await(props.params);
		final todo = TodoStore.find(params.id);
		return switch todo {
			case null: missing();
			case value: renderTodo(value);
		};
	}

	static function missing():Element {
		Navigation.notFound();
		throw new Error("next/navigation.notFound returned instead of interrupting control flow");
	}

	static function renderTodo(todo:Todo):Element {
		final state = todo.completed ? "Complete" : "Open";
		final FailureProbe = FailureRecoveryProbe.client();
		return <main id="todo-detail-page" className="page detail">
			<article className="detail-copy">
				<p className="eyebrow">{todo.priority.value() + " / " + state}</p>
				<h2>{todo.title}</h2>
				<p id="todo-detail-note" className="detail-note">{todo.note}</p>
				<FailureProbe recordTitle={todo.title} />
				<Link className="back-link" href={TodoListPage.href()}>← Return to the ledger</Link>
			</article>
			<dl className="fact-sheet">
				<div className="fact"><dt>Record</dt><dd>{todo.id}</dd></div>
				<div className="fact"><dt>Priority</dt><dd>{todo.priority.value()}</dd></div>
				<div className="fact"><dt>Status</dt><dd>{state}</dd></div>
				<div className="fact"><dt>Runtime</dt><dd>Node.js</dd></div>
			</dl>
		</main>;
	}
}
