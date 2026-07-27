package todoapp.routes;

import genes.js.Async.await;
import js.lib.Promise;
import nextjs.cache.CacheFunction;
import nextjs.codec.DecodeResult;
import nextjs.codec.RequestDecoder;
import nextjs.codec.ResponseJson;
import nextjs.raw.Cache;
import nextjs.raw.Headers;
import nextjs.raw.server.NextRequest;
import nextjs.raw.server.NextResponse.NextResponseBody;
import nextjs.route.NoParams;
import nextjs.route.RouteContext;
import todoapp.cache.CachedTodos;
import todoapp.cache.TodoCacheTag;
import todoapp.domain.Todo;
import todoapp.input.TodoInputCodecs;
import todoapp.persistence.TodoStore;

typedef TodoApiItem = {
	final id:String;
	final completed:Bool;
	final priority:String;
	final title:String;
	final note:String;
}

typedef TodoRequestContext = {
	final source:String;
	final visitor:String;
}

typedef TodoListResponse = {
	final ok:Bool;
	final todos:Array<TodoApiItem>;
	final request:TodoRequestContext;
}

typedef TodoCreateResponse = {
	final ok:Bool;
	final todo:Null<TodoApiItem>;
	final issues:Array<TodoApiIssue>;
	final request:TodoRequestContext;
}

typedef TodoApiIssue = {
	final code:String;
	final path:String;
	final message:String;
}

/**
 * Typed public HTTP boundary for the same domain used by the Haxe UI.
 *
 * Request-only headers and cookies are read here, outside the reusable shared
 * cache. A production mutation must authenticate and authorize before storage.
 *
 * `@:next.route("api/todos")` owns `app/api/todos/route.ts` and checks the
 * Route Handler signatures. Next still supplies `NextRequest`, routing,
 * streaming, and deployment; this annotation only declares the convention
 * file and its typed Haxe implementation.
 */
@:next.route("api/todos")
class TodoApi {
	/**
	 * `@:next.GET` names the exact HTTP export expected by Next.
	 * `@:async` emits a native async function, and `await(...)` emits native
	 * JavaScript await—there is no Haxe scheduler or Promise wrapper.
	 */
	@:next.GET
	@:async
	public static function get(_request:NextRequest, _context:RouteContext<NoParams>):Promise<NextResponseBody<TodoListResponse>> {
		final requestContext = await(readRequestContext());
		final list = CacheFunction.ref(CachedTodos.list);
		final todos = await(list(TodoStore.cacheScope()));
		return ResponseJson.ok({ok: true, todos: todos.map(toApiItem), request: requestContext});
	}

	/**
	 * `@:next.POST` exposes this method as the route's POST handler. The
	 * annotation does not validate request data or authorize callers, so this
	 * body immediately decodes into a closed model before mutation.
	 */
	@:next.POST
	@:async
	public static function create(request:NextRequest, _context:RouteContext<NoParams>):Promise<NextResponseBody<TodoCreateResponse>> {
		final requestContext = await(readRequestContext());
		return switch await(RequestDecoder.json(request, TodoInputCodecs.draftJson)) {
			case Decoded(draft):
				final created = TodoStore.create(draft.title, draft.note, draft.priority);
				Cache.revalidateTag(TodoCacheTag.current(), {expire: 0});
				final noIssues:Array<TodoApiIssue> = [];
				final body:TodoCreateResponse = {
					ok: true,
					todo: toApiItem(created),
					issues: noIssues,
					request: requestContext
				};
				ResponseJson.withStatus(body, 201);
			case Rejected(issues):
				final apiIssues:Array<TodoApiIssue> = [];
				for (issue in issues) {
					final code:String = issue.code;
					apiIssues.push({code: code, path: issue.path, message: issue.message});
				}
				final body:TodoCreateResponse = {
					ok: false,
					todo: null,
					issues: apiIssues,
					request: requestContext
				};
				ResponseJson.withStatus(body, 400);
		};
	}

	@:async
	static function readRequestContext():Promise<TodoRequestContext> {
		final requestHeaders = await(Headers.headers());
		final requestCookies = await(Headers.cookies());
		final source = requestHeaders.get("x-field-ledger-client");
		final visitorCookie = requestCookies.get("field-ledger-visitor").orNull();
		return {
			source: source == null ? "unspecified" : source,
			visitor: visitorCookie == null ? "anonymous" : visitorCookie.value
		};
	}

	static function toApiItem(todo:Todo):TodoApiItem {
		return {
			id: todo.id,
			completed: todo.completed,
			priority: todo.priority.value(),
			title: todo.title,
			note: todo.note
		};
	}
}
