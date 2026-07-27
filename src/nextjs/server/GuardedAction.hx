package nextjs.server;

import genes.js.Async.await;
import js.lib.Promise;
import nextjs.codec.DecodeResult;

/**
 * Ordered, fail-closed control flow inside an ordinary native Server Function.
 *
 * The helper proves stage presence and sequencing. Application callbacks still
 * own session validity, target scoping, policy correctness, transaction safety,
 * and the contents of the public projection.
 */
@:next.serverOnly
class GuardedAction {
	@:async
	public static function run<Operation:ActionOperation, Input, Actor, Target, DomainResult,
		PublicResult>(spec:GuardedActionSpec<Operation, Input, Actor, Target, DomainResult, PublicResult>):Promise<PublicResult> {
		final input = switch spec.decode() {
			case DecodeResult.Decoded(value): value;
			case DecodeResult.Rejected(issues): return spec.reject(GuardRejection.Malformed(issues));
		};

		final actor = switch await(spec.authenticate()) {
			case Authentication.Authenticated(value): value;
			case Authentication.Unauthenticated: return spec.reject(GuardRejection.Unauthenticated);
		};

		final target = switch await(spec.resolve(actor, input)) {
			case TargetResolution.Resolved(value): value;
			case TargetResolution.Missing: return spec.reject(GuardRejection.Unavailable);
		};

		final decision = await(spec.authorize(actor, target, spec.operation, input));
		switch decision {
			case AuthorizationDecision.Allowed:
				null;
			case AuthorizationDecision.Denied:
				return spec.reject(GuardRejection.Unavailable);
		}

		final authorized = new Authorized(spec.operation, actor, target, input);
		return spec.expose(await(spec.execute(authorized)));
	}
}
