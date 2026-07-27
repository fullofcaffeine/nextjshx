package todoapp.client;

import js.lib.Error;
import nextjs.client.React;

typedef FailureRecoveryModel = {
	final trigger:Void->Void;
}

/** Haxe-authored one-shot render failure used by the deliberate boundary drill. */
class FailureRecoveryHook {
	@:next.hook
	public static function useFailureRecovery():FailureRecoveryModel {
		final shouldFail = React.useState(false);
		if (shouldFail.value) {
			throw new Error("FIELD_LEDGER_RECOVERABLE_RENDER");
		}
		return {
			trigger: () -> shouldFail.set(true)
		};
	}
}
