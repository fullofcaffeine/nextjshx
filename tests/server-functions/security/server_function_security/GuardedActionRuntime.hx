package server_function_security;

import genes.js.Async.await;
import haxe.Json;
import js.lib.Error;
import js.lib.Promise;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.server.Authentication;
import nextjs.server.ActionOperation;
import nextjs.server.AuthorizationDecision;
import nextjs.server.Authorized;
import nextjs.server.GuardRejection;
import nextjs.server.GuardedAction;
import nextjs.server.TargetResolution;

typedef Actor = {
	final id:String;
	final tenant:String;
}

typedef ToggleInput = {
	final id:String;
	final expectedVersion:Int;
}

typedef TodoTarget = {
	final id:String;
	final tenant:String;
	final version:Int;
}

typedef DomainChange = {
	final version:Int;
	final auditSecret:String;
}

typedef PublicState = {
	final ok:Bool;
	final code:String;
	final version:Int;
}

class ToggleTodoOperation implements ActionOperation {
	public static final current = new ToggleTodoOperation();

	private function new() {}
}

/** Runtime proof of call ordering, short-circuiting, and result projection. */
class GuardedActionRuntime {
	static final actor:Actor = {id: "actor-a", tenant: "tenant-a"};
	static final target:TodoTarget = {id: "todo-a", tenant: "tenant-a", version: 7};
	static final validInput:ToggleInput = {id: "todo-a", expectedVersion: 7};

	static function assertEqual<T>(actual:T, expected:T, label:String):Void {
		if (actual != expected) {
			throw new Error('$label mismatch: expected $expected, received $actual');
		}
	}

	static function malformedInput():DecodeResult<ToggleInput> {
		return Rejected([
			{
				code: DecodeIssueCode.InvalidValue,
				path: "form.id",
				message: "expected a tenant-scoped todo identifier"
			}
		]);
	}

	@:async
	static function invoke(decodeResult:DecodeResult<ToggleInput>, authentication:Authentication<Actor>, resolution:TargetResolution<TodoTarget>,
			decision:AuthorizationDecision, failMutation:Bool, trace:Array<String>):Promise<PublicState> {
		return await(GuardedAction.run({
			operation: ToggleTodoOperation.current,
			decode: () -> {
				trace.push("decode");
				return decodeResult;
			},
			authenticate: () -> {
				trace.push("authenticate");
				return Promise.resolve(authentication);
			},
			resolve: (currentActor, input) -> {
				trace.push("resolve");
				assertEqual(currentActor.id, actor.id, "resolved actor");
				assertEqual(input.id, validInput.id, "resolved input");
				return Promise.resolve(resolution);
			},
			authorize: (currentActor, currentTarget, operation, input) -> {
				trace.push("authorize");
				assertEqual(currentActor.id, actor.id, "authorized actor");
				assertEqual(currentTarget.id, target.id, "authorized target");
				assertEqual(operation, ToggleTodoOperation.current, "authorized operation");
				final current = currentActor.tenant == currentTarget.tenant && input.expectedVersion == currentTarget.version;
				return Promise.resolve(current ? decision : AuthorizationDecision.Denied);
			},
			execute: (authorized:Authorized<ToggleTodoOperation, Actor, TodoTarget, ToggleInput>) -> {
				trace.push("execute");
				assertEqual(authorized.actor.id, actor.id, "witness actor");
				assertEqual(authorized.target.id, target.id, "witness target");
				assertEqual(authorized.operation, ToggleTodoOperation.current, "witness operation");
				assertEqual(authorized.input.expectedVersion, target.version, "witness input");
				return failMutation ? Promise.reject(new Error("expected mutation rejection")) : Promise.resolve({
					version: authorized.target.version + 1,
					auditSecret: "server-only-audit-secret"
				});
			},
			expose: change -> {
				trace.push("expose");
				return {ok: true, code: "updated", version: change.version};
			},
			reject: rejection -> {
				final code = switch rejection {
					case GuardRejection.Malformed(_): "malformed";
					case GuardRejection.Unauthenticated: "unauthenticated";
					case GuardRejection.Unavailable: "unavailable";
				};
				trace.push('reject:$code');
				return {ok: false, code: code, version: 0};
			}
		}));
	}

	@:async
	static function run():Promise<Void> {
		var trace:Array<String> = [];
		final positive = await(invoke(Decoded(validInput), Authenticated(actor), Resolved(target), Allowed, false, trace));
		assertEqual(trace.join(","), "decode,authenticate,resolve,authorize,execute,expose", "positive order");
		assertEqual(positive.code, "updated", "positive code");
		assertEqual(positive.version, 8, "positive version");
		if (Json.stringify(positive).indexOf("server-only-audit-secret") != -1) {
			throw new Error("public projection exposed the domain audit secret");
		}

		trace = [];
		final malformed = await(invoke(malformedInput(), Authenticated(actor), Resolved(target), Allowed, false, trace));
		assertEqual(trace.join(","), "decode,reject:malformed", "malformed short circuit");
		assertEqual(malformed.code, "malformed", "malformed code");

		trace = [];
		final unauthenticated = await(invoke(Decoded(validInput), Unauthenticated, Resolved(target), Allowed, false, trace));
		assertEqual(trace.join(","), "decode,authenticate,reject:unauthenticated", "unauthenticated short circuit");
		assertEqual(unauthenticated.code, "unauthenticated", "unauthenticated code");

		trace = [];
		final missing = await(invoke(Decoded(validInput), Authenticated(actor), Missing, Allowed, false, trace));
		assertEqual(trace.join(","), "decode,authenticate,resolve,reject:unavailable", "missing short circuit");
		assertEqual(missing.code, "unavailable", "missing code");

		trace = [];
		final unauthorized = await(invoke(Decoded(validInput), Authenticated(actor), Resolved(target), Denied, false, trace));
		assertEqual(trace.join(","), "decode,authenticate,resolve,authorize,reject:unavailable", "unauthorized short circuit");
		assertEqual(unauthorized.code, "unavailable", "unauthorized code");

		trace = [];
		final staleInput:ToggleInput = {id: "todo-a", expectedVersion: 6};
		final stale = await(invoke(Decoded(staleInput), Authenticated(actor), Resolved(target), Allowed, false, trace));
		assertEqual(trace.join(","), "decode,authenticate,resolve,authorize,reject:unavailable", "stale target short circuit");
		assertEqual(stale.code, "unavailable", "stale code");

		trace = [];
		var mutationRejected = false;
		try {
			await(invoke(Decoded(validInput), Authenticated(actor), Resolved(target), Allowed, true, trace));
		} catch (_error:Error) {
			mutationRejected = true;
		}
		assertEqual(mutationRejected, true, "mutation rejection propagation");
		assertEqual(trace.join(","), "decode,authenticate,resolve,authorize,execute", "mutation rejection order");
	}

	static function main():Void {
		run().then(_ -> TestConsole.log("guarded-action-runtime: OK: ordered authorization and fail-closed projection"));
	}
}
