package server_functions.app;

import genes.js.Async.await;
import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageProps;
import nextjs.client.ClientComponent;
import nextjs.raw.Headers;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;
import nextjs.server.Authentication;
import server_functions.client.TodoActionForm;
import server_functions.security.GuardedTodoPolicy;

/** Server page that observes the action's HTTP-only mutation after submission. */
@:next.page("")
class HomePage {
	@:async
	public static function render(_props:PageProps<NoParams, SearchParams>):Promise<Element> {
		final ActionForm = ClientComponent.ref(TodoActionForm);
		final cookieStore = await(Headers.cookies());
		final saved = cookieStore.get(GuardedTodoPolicy.TITLE_COOKIE).orNull();
		final title = saved == null ? "No submitted title" : saved.value;
		final actor = await(GuardedTodoPolicy.currentActor());
		final version = await(GuardedTodoPolicy.currentVersion());
		final form = switch actor {
			case Authenticated(_): <ActionForm workspaceId="workspace-a" expectedVersion={version} />;
			case Unauthenticated: <p id="guarded-signed-out">Sign in to edit this workspace.</p>;
		};
		return
			<main style={{width: "min(34rem, calc(100% - 2rem))", margin: "5rem auto", padding: "2rem", background: "#fffdf8", border: "1px solid #d8cdbb", borderRadius: "1.5rem"}}>
			<p style={{color: "#765f42"}}>Native Next Server Function</p>
			<h1>One typed boundary, no RPC layer.</h1>
			<p id="submitted-title" aria-live="polite">{title}</p>
			{form}
		</main>;
	}
}
