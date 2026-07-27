package todoapp.client;

import js.lib.Error;
import nextjs.client.React;

typedef FailureRecoveryModel = {
	final trigger:Void->Void;
}

/**
 * Haxe-authored one-shot render failure used by the deliberate boundary drill.
 *
 * The Hook itself has no class identity. This static shell is retained only
 * because the current analyzer bridge lifts a public static field into a
 * native module function; the generic direct-module form belongs in
 * `genes.react`.
 */
class FailureRecoveryHook {
	/**
	 * `@:next.hook` gives this function a reviewed Hook identity and enables
	 * Haxe-side top-level placement diagnostics. Semantic `State<Bool>` uses
	 * `.value` to read and `.set` to replace without allocating a wrapper.
	 */
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
