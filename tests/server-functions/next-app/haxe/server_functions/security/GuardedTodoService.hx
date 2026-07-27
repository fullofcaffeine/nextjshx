package server_functions.security;

import genes.js.Async.await;
import js.lib.Promise;
import nextjs.raw.Headers;
import nextjs.raw.headers.CookieTypes.CookieSameSite;
import nextjs.server.Authorized;
import server_functions.security.GuardedTodoTypes.GuardedActor;
import server_functions.security.GuardedTodoTypes.SaveDomainChange;
import server_functions.security.GuardedTodoTypes.SaveTodoInput;
import server_functions.security.GuardedTodoTypes.SaveTodoOperation;
import server_functions.security.GuardedTodoTypes.WorkspaceTarget;

/** Protected mutation service: callers need the exact save-operation witness. */
@:next.serverOnly
class GuardedTodoService {
	@:async
	public static function save(authorized:Authorized<SaveTodoOperation, GuardedActor, WorkspaceTarget, SaveTodoInput>):Promise<SaveDomainChange> {
		final nextVersion = authorized.target.version + 1;
		final cookieStore = await(Headers.mutableCookies());
		cookieStore.set(GuardedTodoPolicy.TITLE_COOKIE, authorized.input.title, {
			httpOnly: true,
			path: "/",
			sameSite: CookieSameSite.Lax
		});
		cookieStore.set(GuardedTodoPolicy.VERSION_COOKIE, Std.string(nextVersion), {
			httpOnly: true,
			path: "/",
			sameSite: CookieSameSite.Lax
		});
		return {
			title: authorized.input.title,
			version: nextVersion,
			auditSecret: "server-only-audit-secret"
		};
	}
}
