package server_functions_negative;

import js.lib.Promise;
import nextjs.codec.DecodeResult;
import nextjs.server.ActionOperation;
import nextjs.server.Authentication;
import nextjs.server.GuardRejection;
import nextjs.server.GuardedAction;
import nextjs.server.TargetResolution;

typedef MissingAuthorizerState = {
	final ok:Bool;
}

class SaveOperation implements ActionOperation {
	public static final current = new SaveOperation();

	private function new() {}
}

class MissingAuthorizer {
	public static function run():Promise<MissingAuthorizerState> {
		return GuardedAction.run({
			operation: SaveOperation.current,
			decode: () -> DecodeResult.Decoded("input"),
			authenticate: () -> Promise.resolve(Authentication.Authenticated("actor")),
			resolve: (_actor, _input) -> Promise.resolve(TargetResolution.Resolved("target")),
			execute: _authorized -> Promise.resolve("domain"),
			expose: _domain -> {
				ok: true
			},
			reject: (_rejection:GuardRejection) -> {ok: false}
		});
	}
}
