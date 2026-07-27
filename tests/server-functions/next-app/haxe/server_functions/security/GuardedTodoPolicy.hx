package server_functions.security;

import genes.js.Async.await;
import js.lib.Promise;
import nextjs.raw.Headers;
import nextjs.server.Authentication;
import nextjs.server.AuthorizationDecision;
import nextjs.server.TargetResolution;
import server_functions.security.GuardedTodoTypes.GuardedActor;
import server_functions.security.GuardedTodoTypes.SaveTodoInput;
import server_functions.security.GuardedTodoTypes.SaveTodoOperation;
import server_functions.security.GuardedTodoTypes.WorkspaceTarget;

/** Deterministic request-local identity and exact-workspace policy fixture. */
@:next.serverOnly
class GuardedTodoPolicy {
	public static inline final SESSION_COOKIE = "nextjshx-guarded-session";
	public static inline final SESSION_TOKEN = "session-actor-a";
	public static inline final TITLE_COOKIE = "nextjshx-action-title";
	public static inline final VERSION_COOKIE = "nextjshx-workspace-version";

	@:async
	public static function currentActor():Promise<Authentication<GuardedActor>> {
		final session = (await(Headers.cookies())).get(SESSION_COOKIE).orNull();
		return session != null && session.value == SESSION_TOKEN ? Authenticated({id: "actor-a", tenant: "tenant-a"}) : Unauthenticated;
	}

	@:async
	public static function currentVersion():Promise<Int> {
		final version = (await(Headers.cookies())).get(VERSION_COOKIE).orNull();
		return version != null && version.value == "2" ? 2 : 1;
	}

	@:async
	public static function resolve(actor:GuardedActor, input:SaveTodoInput):Promise<TargetResolution<WorkspaceTarget>> {
		if (actor.id != "actor-a" || actor.tenant != "tenant-a") {
			return Missing;
		}
		final version = await(currentVersion());
		return switch input.workspaceId {
			case "workspace-a": Resolved({
					id: "workspace-a",
					tenant: "tenant-a",
					ownerId: "actor-a",
					version: version
				});
			case "workspace-b": Resolved({
					id: "workspace-b",
					tenant: "tenant-b",
					ownerId: "actor-b",
					version: version
				});
			case _: Missing;
		};
	}

	@:async
	public static function authorize(actor:GuardedActor, target:WorkspaceTarget, operation:SaveTodoOperation,
			input:SaveTodoInput):Promise<AuthorizationDecision> {
		final allowed = operation == SaveTodoOperation.current
			&& actor.id == target.ownerId
			&& actor.tenant == target.tenant
			&& input.workspaceId == target.id
			&& input.expectedVersion == target.version;
		return allowed ? Allowed : Denied;
	}
}
