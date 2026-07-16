import haxe.macro.Context;
import haxe.macro.Expr;

/**
 * Emits a fixture-only diagnostic for testing the negative-test runner.
 *
 * Why: future NextJsHx macros must fail with stable codes and useful Haxe
 * positions. The harness needs one deliberately failing declaration before
 * those product macros exist.
 *
 * What: calling `reject()` stops compilation with `NXHX-CONFIG-0001` at the
 * call expression rather than at this helper.
 *
 * How: a macro receives the caller position through `Context.currentPos()` and
 * reports the same structured message that the runner checks exactly.
 */
class DiagnosticProbe {
	public static macro function reject():Expr {
		Context.error("[NXHX-CONFIG-0001] The baseline negative fixture deliberately rejects this declaration.", Context.currentPos());
		return macro null;
	}
}
