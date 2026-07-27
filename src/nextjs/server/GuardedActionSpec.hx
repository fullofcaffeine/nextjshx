package nextjs.server;

import js.lib.Promise;
import nextjs.codec.DecodeResult;

/** Required stages for one guarded native Server Function invocation. */
typedef GuardedActionSpec<Operation:ActionOperation, Input, Actor, Target, DomainResult, PublicResult> = {
	final operation:Operation;
	final decode:Void->DecodeResult<Input>;
	final authenticate:Void->Promise<Authentication<Actor>>;
	final resolve:(Actor, Input) -> Promise<TargetResolution<Target>>;
	final authorize:(Actor, Target, Operation, Input) -> Promise<AuthorizationDecision>;
	final execute:Authorized<Operation, Actor, Target, Input>->Promise<DomainResult>;
	final expose:DomainResult->PublicResult;
	final reject:GuardRejection->PublicResult;
}
